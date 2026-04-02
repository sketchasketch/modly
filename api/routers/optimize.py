import os
import re
import shutil
import tempfile
import uuid

import pymeshlab
import trimesh
import trimesh.visual
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

from services.generator_registry import WORKSPACE_DIR

router = APIRouter(tags=["optimize"])


class OptimizeRequest(BaseModel):
    path: str        # format: "{collection}/{filename}"
    target_faces: int


class SmoothRequest(BaseModel):
    path: str        # format: "{collection}/{filename}"
    iterations: int


@router.post("/mesh")
def optimize_mesh(body: OptimizeRequest):
    target_faces = max(100, min(500_000, body.target_faces))

    # Security: prevent path traversal
    input_path = (WORKSPACE_DIR / body.path).resolve()
    if not str(input_path).startswith(str(WORKSPACE_DIR.resolve())):
        raise HTTPException(400, "Invalid path")
    if not input_path.exists():
        raise HTTPException(404, f"File not found: {body.path}")

    tmp_dir = tempfile.mkdtemp()
    try:
        result = _decimate(str(input_path), target_faces, tmp_dir)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    stem = input_path.stem
    output_name = f"{stem}_opt{target_faces}.glb"
    output_path = input_path.parent / output_name
    result.export(str(output_path))

    # Reconstruct the collection name from the path
    collection_name = body.path.split("/")[0]
    face_count = len(result.faces)
    return {"url": f"/workspace/{collection_name}/{output_name}", "face_count": face_count}


def _has_texture(geom: trimesh.Trimesh) -> bool:
    return (
        isinstance(geom.visual, trimesh.visual.TextureVisuals)
        and geom.visual.material is not None
        and getattr(geom.visual.material, "image", None) is not None
    )


def _decimate(input_path: str, target_faces: int, tmp_dir: str) -> trimesh.Trimesh:
    loaded = trimesh.load(input_path)
    if isinstance(loaded, trimesh.Scene):
        geoms = list(loaded.geometry.values())
        geom = trimesh.util.concatenate(geoms) if len(geoms) > 1 else geoms[0]
    else:
        geom = loaded

    ms = pymeshlab.MeshSet()

    if _has_texture(geom):
        # ── Textured path: OBJ intermediate to preserve UV coordinates ──────
        obj_in  = os.path.join(tmp_dir, "input.obj")
        mtl_in  = os.path.join(tmp_dir, "input.mtl")
        tex_in  = os.path.join(tmp_dir, "texture.png")
        obj_out = os.path.join(tmp_dir, "output.obj")

        # Save texture image under a known filename
        geom.visual.material.image.save(tex_in)

        # Export OBJ (trimesh writes UV coords + MTL)
        geom.export(obj_in)

        # Patch MTL so any map_Kd points to our known texture filename
        if os.path.exists(mtl_in):
            mtl = open(mtl_in).read()
            mtl = re.sub(r"map_Kd\s+\S+", "map_Kd texture.png", mtl)
            open(mtl_in, "w").write(mtl)

        ms.load_new_mesh(obj_in)
        ms.meshing_decimation_quadric_edge_collapse(
            targetfacenum=target_faces,
            preservetexcoord=True,   # ← keeps UV coordinates intact
            preservenormal=True,
            preservetopology=True,
            autoclean=True,
        )
        ms.save_current_mesh(obj_out)

        # Patch output MTL too, so trimesh can find the texture on load
        mtl_out = obj_out.replace(".obj", ".mtl")
        if os.path.exists(mtl_out):
            mtl = open(mtl_out).read()
            mtl = re.sub(r"map_Kd\s+\S+", "map_Kd texture.png", mtl)
            open(mtl_out, "w").write(mtl)

        return trimesh.load(obj_out)

    else:
        # ── Geometry-only path: PLY (fast, no texture to worry about) ────────
        ply_in  = os.path.join(tmp_dir, "input.ply")
        ply_out = os.path.join(tmp_dir, "output.ply")

        geom.export(ply_in)
        ms.load_new_mesh(ply_in)
        ms.meshing_decimation_quadric_edge_collapse(
            targetfacenum=target_faces,
            preservenormal=True,
            preservetopology=True,
            autoclean=True,
        )
        ms.save_current_mesh(ply_out)
        return trimesh.load(ply_out, force="mesh")


@router.post("/smooth")
def smooth_mesh(body: SmoothRequest):
    iterations = max(1, min(20, body.iterations))

    input_path = (WORKSPACE_DIR / body.path).resolve()
    if not str(input_path).startswith(str(WORKSPACE_DIR.resolve())):
        raise HTTPException(400, "Invalid path")
    if not input_path.exists():
        raise HTTPException(404, f"File not found: {body.path}")

    tmp_dir = tempfile.mkdtemp()
    try:
        result = _smooth(str(input_path), iterations, tmp_dir)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    stem = input_path.stem
    output_name = f"{stem}_smooth{iterations}.glb"
    output_path = input_path.parent / output_name
    result.export(str(output_path))

    collection_name = body.path.split("/")[0]
    return {"url": f"/workspace/{collection_name}/{output_name}"}


def _smooth(input_path: str, iterations: int, tmp_dir: str) -> trimesh.Trimesh:
    loaded = trimesh.load(input_path)
    if isinstance(loaded, trimesh.Scene):
        geoms = list(loaded.geometry.values())
        geom = trimesh.util.concatenate(geoms) if len(geoms) > 1 else geoms[0]
    else:
        geom = loaded

    ms = pymeshlab.MeshSet()

    if _has_texture(geom):
        obj_in  = os.path.join(tmp_dir, "input.obj")
        mtl_in  = os.path.join(tmp_dir, "input.mtl")
        tex_in  = os.path.join(tmp_dir, "texture.png")
        obj_out = os.path.join(tmp_dir, "output.obj")

        geom.visual.material.image.save(tex_in)
        geom.export(obj_in)

        if os.path.exists(mtl_in):
            mtl = open(mtl_in).read()
            mtl = re.sub(r"map_Kd\s+\S+", "map_Kd texture.png", mtl)
            open(mtl_in, "w").write(mtl)

        ms.load_new_mesh(obj_in)
        ms.apply_coord_laplacian_smoothing(stepsmoothnum=iterations)
        ms.save_current_mesh(obj_out)

        mtl_out = obj_out.replace(".obj", ".mtl")
        if os.path.exists(mtl_out):
            mtl = open(mtl_out).read()
            mtl = re.sub(r"map_Kd\s+\S+", "map_Kd texture.png", mtl)
            open(mtl_out, "w").write(mtl)

        return trimesh.load(obj_out)

    else:
        ply_in  = os.path.join(tmp_dir, "input.ply")
        ply_out = os.path.join(tmp_dir, "output.ply")

        geom.export(ply_in)
        ms.load_new_mesh(ply_in)
        ms.apply_coord_laplacian_smoothing(stepsmoothnum=iterations)
        ms.save_current_mesh(ply_out)
        return trimesh.load(ply_out, force="mesh")


@router.post("/import")
async def import_mesh(file: UploadFile = File(...)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("glb", "obj", "stl", "ply"):
        raise HTTPException(400, f"Unsupported format: {ext}")

    collection = f"import_{uuid.uuid4().hex[:8]}"
    collection_dir = WORKSPACE_DIR / collection
    collection_dir.mkdir(parents=True, exist_ok=True)

    content = await file.read()

    if ext == "glb":
        output_path = collection_dir / "mesh.glb"
        output_path.write_bytes(content)
    else:
        tmp_input = collection_dir / f"input.{ext}"
        tmp_input.write_bytes(content)
        try:
            loaded = trimesh.load(str(tmp_input))
            output_path = collection_dir / "mesh.glb"
            loaded.export(str(output_path))
        finally:
            tmp_input.unlink(missing_ok=True)

    return {"url": f"/workspace/{collection}/mesh.glb"}


@router.get("/export")
def export_mesh(path: str, format: str):
    if format not in ("obj", "stl", "ply"):
        raise HTTPException(400, "Supported formats: obj, stl, ply")

    input_path = (WORKSPACE_DIR / path).resolve()
    if not str(input_path).startswith(str(WORKSPACE_DIR.resolve())):
        raise HTTPException(400, "Invalid path")
    if not input_path.exists():
        raise HTTPException(404, f"File not found: {path}")

    loaded = trimesh.load(str(input_path))
    if isinstance(loaded, trimesh.Scene):
        geoms = list(loaded.geometry.values())
        mesh = trimesh.util.concatenate(geoms) if len(geoms) > 1 else geoms[0]
    else:
        mesh = loaded

    data = mesh.export(file_type=format)
    stem = input_path.stem
    mime = "text/plain" if format == "obj" else "application/octet-stream"
    # trimesh exports ply as bytes even in text mode — octet-stream is fine for all binary formats
    return Response(
        content=data,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{stem}.{format}"'},
    )
