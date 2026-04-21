# 0006 Generation Observability And Cancel

- Status: approved
- Date: 2026-04-21

## Decision

Generation progress must be honest about what it can and cannot observe, and cancel must never leave the UI lying.

- Upstream library tqdm bars are kept **enabled** in generators, not suppressed.
- Step-callback text updates at the boundary between observable phases (e.g. diffusion → silent volume decode) so the top-line HUD text doesn't freeze on stale progress.
- Phase-boundary logs are emitted to stderr at known transitions with elapsed times, so the user has a readable timeline in the HUD's log pane even when an upstream phase emits no tqdm.
- Cancel immediately clears renderer-side job state so the HUD does not keep showing progress after the user has pressed Stop, regardless of how long the backend takes to actually tear down.

## Context

The pipeline used by Hy3D2 has a diffusion loop with a step callback, followed by a volume-decode loop plus marching cubes — all inside a single blocking `pipeline(...)` call. The step callback stops firing when diffusion ends, so from the generator's perspective the "silent" post-diffusion phase is a single blocking native call with no hooks.

An earlier implementation of the Hy3D2 generator passed `enable_pbar=False`, which disabled the pipeline's own `Volume Decoding` tqdm bar. The result: the HUD's top line stayed frozen at "Generating mesh… N/N" while the user watched a black box chew through several minutes of decode with no indication anything was happening — and no way to distinguish a working decode from a hung pipeline.

Similarly, an earlier Stop implementation set the renderer's run state to idle on click but did not clear `currentJob`. The button said "Generate 3D Model" while the HUD still displayed "Generating mesh… N/N". Users reasonably read this as "Stop doesn't work".

## Consequences

- Generators should pass `enable_pbar=True` to upstream libraries wherever available. Their tqdm output flows subprocess stderr → extension process stderr forwarder → Python bridge stderr → renderer `python:log` IPC → HUD tqdm-log line, and the user reads it in real time.
- Generators emit phase-boundary stamps to stderr with timings (for example, `[hy3d2] pipeline.start ...`, `pipeline.return elapsed=23.4s`, `trimesh.convert elapsed=0.12s verts=... tris=...`, `export.glb elapsed=1.1s`). This gives a post-hoc readable timeline even when an upstream phase is opaque.
- The last call of a step callback updates the HUD step text to an honest description of what runs next (for example, `"Decoding volume (no step callback)…"`). Do not leave the top-line stale; text that silently lies is worse than a missing text.
- On cancel, the renderer clears `currentJob` (HUD disappears) and sets local run state to idle atomically. The backend hard-kill is asynchronous (see ADR 0005); the UI does not wait for it.
- Errors shown in the generation HUD are copyable and selectable, and the container grows to fit multi-line tracebacks. The same contract applies to the global error modal.
- Because subprocess stderr is the observability pipe, `print(..., file=sys.stderr, flush=True)` is the canonical way for extensions to surface anything to the user. Extension authors should assume stderr lines are user-facing.
