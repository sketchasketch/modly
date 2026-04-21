# 0007 Quad Retopology

- Status: approved
- Date: 2026-04-21

## Decision

Quad retopology is provided as a standalone Python process extension (`modly-quadriflow-mac`, distributed under Sketchy Labs), not bundled into Modly core.

Implementation uses `pyinstantmeshes` (MIT, Apple-Silicon arm64 wheels on PyPI for cp311–cp313) to run Wenzel Jakob's Instant Meshes as a field-aligned quad remesher. Not `pyquadriflow` (no arm64 wheels) and not pymeshlab's pairwise tri-to-quad (not field-aligned — produces hinged triangle pairs, not edge flow).

## Context

Hy3D2 produces dense triangle soup. Texturing, rigging, and animation all expect clean quad edge flow. Pairwise triangle merging doesn't produce quads that follow curvature — the output looks like an amateur auto-retopo pass, not a professionally meshed asset.

Field-aligned methods (Instant Meshes, Quadriflow) solve a global optimization over the mesh surface to align edges with principal curvature directions. Instant Meshes has a working arm64 Python binding via `pyinstantmeshes`; Quadriflow's Python bindings currently lack arm64 wheels.

## Consequences

- New extension `modly-quadriflow-mac` lives under Sketchy Labs, installed from folder or GitHub like Hy3D2-mac.
- Extension is `type: "process"` with `entry: "processor.py"`, handled by Modly's existing `PythonProcessRunner` (`electron/main/process-runner.ts`). Zero Modly core changes required.
- Protocol: reads `{ input: { filePath }, params }` on stdin, writes `{ type: 'progress'|'done'|'error', ... }` on stdout. Output is a mesh file path written under the shared workspace.
- Node declares `input: "mesh"`, `output: "mesh"`. Workflow position: between shape generation (Hy3D2) and UV unwrap (ADR 0008).
- Setup guards Apple Silicon per ADR 0001: `pyinstantmeshes` is installed only on darwin/arm64.
- Extension runs CPU-bound with modest memory (single mesh at a time, ~tens of MB) — does not compete with generative models for MPS per ADR 0003.
