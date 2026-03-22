"""
GeneratorRegistry — manages the lifecycle of all model adapters.
Dynamically loads extensions from the extensions/ folder.

To add a new model: create a folder in extensions/ with
  - manifest.json  (metadata + hf_repo + pip_requirements...)
  - generator.py   (class extending BaseGenerator)
No other file needs to be modified.
"""
import base64
import importlib.util
import json
import os
import sys
from pathlib import Path
from typing import Dict, Optional, Tuple

from services.generators.base import BaseGenerator

# ------------------------------------------------------------------ #
# Signature verification
# ------------------------------------------------------------------ #

_PUBLIC_KEY_PATH = Path(__file__).parent.parent / "resources" / "public_key.pem"


def _verify_signature(generator_path: Path, manifest: dict) -> tuple:
    """
    Verifies the signature of a generator.py file against the manifest.

    Returns (is_verified: bool, status: str) where status is one of:
      "verified"  — signature present and valid
      "unsigned"  — no signature in manifest (third-party extension)
      "invalid"   — signature present but verification failed (tampered file)
      "error"     — verification could not be performed
    """
    signature_b64 = manifest.get("signature")

    if not signature_b64:
        return False, "unsigned"

    if not _PUBLIC_KEY_PATH.exists():
        print(f"[Registry] WARNING: public_key.pem not found at {_PUBLIC_KEY_PATH}, skipping verification")
        return False, "error"

    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives.serialization import load_pem_public_key

        public_key        = load_pem_public_key(_PUBLIC_KEY_PATH.read_bytes())
        signature         = base64.b64decode(signature_b64)
        generator_content = generator_path.read_bytes().replace(b"\r\n", b"\n")

        try:
            public_key.verify(signature, generator_content)
            return True, "verified"
        except InvalidSignature:
            return False, "invalid"

    except Exception as exc:
        print(f"[Registry] WARNING: Signature verification error: {exc}")
        return False, "error"

# ------------------------------------------------------------------ #
# Global paths
# ------------------------------------------------------------------ #

_models_dir_raw    = os.environ.get("MODELS_DIR")    or str(Path.home() / ".modly" / "models")
_workspace_dir_raw = os.environ.get("WORKSPACE_DIR") or str(Path.home() / ".modly" / "workspace")
MODELS_DIR    = Path(_models_dir_raw)
WORKSPACE_DIR = Path(_workspace_dir_raw)

MODELS_DIR.mkdir(parents=True, exist_ok=True)
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

# extensions/ folder — in userData (passed by Electron via EXTENSIONS_DIR)
_extensions_dir_raw = os.environ.get("EXTENSIONS_DIR", "")
EXTENSIONS_DIR = Path(_extensions_dir_raw) if _extensions_dir_raw else None

print(f"[Registry] MODELS_DIR     = {MODELS_DIR}")
print(f"[Registry] WORKSPACE_DIR  = {WORKSPACE_DIR}")
print(f"[Registry] EXTENSIONS_DIR = {EXTENSIONS_DIR or '(not set)'}")


# ------------------------------------------------------------------ #
# Extension loader
# ------------------------------------------------------------------ #

def _discover_extensions() -> Dict[str, Tuple[type, dict]]:
    """
    Scans EXTENSIONS_DIR to find valid extensions.
    Each extension must have manifest.json + generator.py.
    Returns {model_id: (GeneratorClass, manifest_dict)}.
    """
    result: Dict[str, Tuple[type, dict]] = {}

    if EXTENSIONS_DIR is None or not EXTENSIONS_DIR.exists():
        print(f"[Registry] WARNING: EXTENSIONS_DIR not set or not found: {EXTENSIONS_DIR}")
        return result

    for ext_dir in sorted(EXTENSIONS_DIR.iterdir()):
        if not ext_dir.is_dir():
            continue

        manifest_path  = ext_dir / "manifest.json"
        generator_path = ext_dir / "generator.py"

        if not manifest_path.exists():
            print(f"[Registry] Skipping '{ext_dir.name}': missing manifest.json")
            continue
        if not generator_path.exists():
            print(f"[Registry] Skipping '{ext_dir.name}': missing generator.py")
            continue

        try:
            manifest   = json.loads(manifest_path.read_text(encoding="utf-8"))
            ext_id     = manifest["id"]
            class_name = manifest["generator_class"]

            # Verify signature before loading
            is_verified, sig_status = _verify_signature(generator_path, manifest)
            manifest["_verified"]   = is_verified
            manifest["_sig_status"] = sig_status

            if sig_status == "invalid":
                print(
                    f"[Registry] SECURITY: Extension '{ext_dir.name}' has an INVALID signature. "
                    "The generator.py may have been tampered with. Skipping."
                )
                continue
            elif sig_status == "unsigned":
                print(
                    f"[Registry] WARNING: Extension '{ext_dir.name}' is unsigned "
                    "(unverified third-party extension). Loading with caution."
                )
            elif sig_status == "verified":
                print(f"[Registry] OK: Extension '{ext_dir.name}' signature verified.")

            # Dynamically load the generator.py module
            module_name = f"extensions.{ext_id}.generator"
            spec   = importlib.util.spec_from_file_location(module_name, generator_path)
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)

            cls = getattr(module, class_name)

            # Multi-variant: register one generator per variant if manifest.models[] is present
            variants = [v for v in manifest.get("models", []) if v.get("id") and v.get("hf_repo")]
            if variants:
                for variant in variants:
                    variant_manifest = {
                        **manifest,
                        "id":      variant["id"],
                        "name":    variant.get("name", variant["id"]),
                        "hf_repo": variant["hf_repo"],
                    }
                    # Per-variant fields override the top-level ones if present
                    for field in ("hf_skip_prefixes", "download_check"):
                        if field in variant:
                            variant_manifest[field] = variant[field]
                    result[variant["id"]] = (cls, variant_manifest)
                    print(f"[Registry] Loaded extension variant: {variant['id']} (from '{ext_id}')")
            else:
                result[ext_id] = (cls, manifest)
                print(f"[Registry] Loaded extension: {ext_id} ({class_name})")

        except Exception as exc:
            print(f"[Registry] ERROR loading extension '{ext_dir.name}': {exc}")

    return result


# ------------------------------------------------------------------ #
# GeneratorRegistry
# ------------------------------------------------------------------ #

class GeneratorRegistry:
    def __init__(self) -> None:
        self._generators: Dict[str, BaseGenerator] = {}
        self._manifests:  Dict[str, dict]          = {}
        self._errors:     Dict[str, str]           = {}
        self._active_id:  str = os.environ.get("SELECTED_MODEL_ID", "sf3d")

    def initialize(self) -> None:
        """Discovers and instantiates all extensions. Call at startup."""
        extensions = _discover_extensions()

        for model_id, (cls, manifest) in extensions.items():
            try:
                gen = cls(MODELS_DIR / model_id, WORKSPACE_DIR)
                # Inject manifest fields onto the generator
                gen.hf_repo          = manifest.get("hf_repo", "")
                gen.hf_skip_prefixes = manifest.get("hf_skip_prefixes", [])
                gen.download_check   = manifest.get("download_check", "")
                gen._params_schema   = manifest.get("params_schema", [])
                self._generators[model_id] = gen
                self._manifests[model_id]  = manifest
                # Clear any previous error for this extension
                self._errors.pop(model_id, None)
            except Exception as exc:
                msg = f"Failed to instantiate generator '{model_id}': {exc}"
                print(f"[Registry] ERROR: {msg}")
                self._errors[model_id] = msg

        if not self._generators:
            print("[Registry] WARNING: No extensions found.")
            return

        if self._active_id not in self._generators:
            fallback = next(iter(self._generators))
            print(
                f"[Registry] WARNING: SELECTED_MODEL_ID='{self._active_id}' is unknown. "
                f"Falling back to '{fallback}'."
            )
            self._active_id = fallback

        print(f"[Registry] Active model  : {self._active_id}")
        print(f"[Registry] All models    : {list(self._generators.keys())}")

    def reload(self) -> None:
        """
        Re-scans extensions and updates the registry without restarting FastAPI.
        Unloads all current generators before reloading.
        """
        print("[Registry] Reloading extensions…")
        for gen in self._generators.values():
            try:
                gen.unload()
            except Exception:
                pass
        self._generators.clear()
        self._manifests.clear()
        self._errors.clear()
        self.initialize()
        print("[Registry] Reload complete.")

    def load_errors(self) -> Dict[str, str]:
        """Returns extension loading errors."""
        return dict(self._errors)

    # ------------------------------------------------------------------ #
    # Generator access
    # ------------------------------------------------------------------ #

    def get_active(self) -> BaseGenerator:
        """Returns the active generator. Downloads and loads if necessary."""
        gen = self._generators[self._active_id]
        if not gen.is_loaded():
            if not gen.is_downloaded():
                gen._auto_download()
            gen.load()
        return gen

    def get_generator(self, model_id: str) -> BaseGenerator:
        if model_id not in self._generators:
            raise ValueError(
                f"Unknown model ID: '{model_id}'. "
                f"Available: {list(self._generators.keys())}"
            )
        return self._generators[model_id]

    def get_manifest(self, model_id: str) -> dict:
        """Returns the manifest of an extension."""
        if model_id not in self._manifests:
            raise KeyError(f"No manifest for model ID: '{model_id}'")
        return self._manifests[model_id]

    def switch_model(self, model_id: str) -> None:
        """Switches the active model. Unloads the previous one if different."""
        if model_id not in self._generators:
            raise ValueError(
                f"Unknown model ID: '{model_id}'. "
                f"Available: {list(self._generators.keys())}"
            )
        if model_id != self._active_id:
            if self._active_id in self._generators:
                self._generators[self._active_id].unload()
            self._active_id = model_id

    # ------------------------------------------------------------------ #
    # Status
    # ------------------------------------------------------------------ #

    def active_status(self) -> dict:
        gen      = self._generators[self._active_id]
        manifest = self._manifests[self._active_id]
        return {
            "id":         self._active_id,
            "name":       manifest.get("name", gen.DISPLAY_NAME),
            "downloaded": gen.is_downloaded(),
            "loaded":     gen.is_loaded(),
        }

    def all_status(self) -> list:
        result = []
        for model_id, gen in self._generators.items():
            manifest = self._manifests[model_id]
            result.append({
                "id":          model_id,
                "name":        manifest.get("name", gen.DISPLAY_NAME),
                "description": manifest.get("description", ""),
                "version":     manifest.get("version", ""),
                "vram_gb":     manifest.get("vram_gb", gen.VRAM_GB),
                "hf_repo":     manifest.get("hf_repo", ""),
                "tags":        manifest.get("tags", []),
                "downloaded":  gen.is_downloaded(),
                "loaded":      gen.is_loaded(),
                "active":      model_id == self._active_id,
                "verified":    manifest.get("_verified", False),
                "sig_status":  manifest.get("_sig_status", "unsigned"),
            })
        return result

    def params_schema(self, model_id: Optional[str] = None) -> list:
        target_id = model_id or self._active_id
        if target_id not in self._generators:
            raise KeyError(target_id)
        return self._generators[target_id].params_schema()

    # ------------------------------------------------------------------ #
    # Paths update & shutdown
    # ------------------------------------------------------------------ #

    def update_paths(self, models_dir: Optional[Path], workspace_dir: Optional[Path]) -> None:
        global MODELS_DIR, WORKSPACE_DIR
        import services.generator_registry as _self_module

        if models_dir is not None:
            self.unload_all()
            models_dir.mkdir(parents=True, exist_ok=True)
            _self_module.MODELS_DIR = models_dir
            for model_id, gen in self._generators.items():
                gen.model_dir = models_dir / model_id

        if workspace_dir is not None:
            workspace_dir.mkdir(parents=True, exist_ok=True)
            _self_module.WORKSPACE_DIR = workspace_dir
            for gen in self._generators.values():
                gen.outputs_dir = workspace_dir

    def unload_all(self) -> None:
        for gen in self._generators.values():
            gen.unload()


# Singleton
generator_registry = GeneratorRegistry()
