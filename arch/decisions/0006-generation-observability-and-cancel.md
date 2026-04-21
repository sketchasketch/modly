# 0006 Generation Observability And Cancel

- Status: approved
- Date: 2026-04-21

## Decision

- Generators keep upstream tqdm bars enabled.
- The renderer parses tqdm into `Verbing (N%)` for the HUD sub-line; non-progress stderr is dropped from the UI.
- Step-callback text updates at phase boundaries so the top-line doesn't freeze.
- Cancel clears renderer job state immediately; the backend kill is async (see ADR 0005).

## Context

Hy3D2's pipeline runs diffusion (with a step callback) then volume decode + marching cubes (no callback) inside a single blocking call. With `enable_pbar=False`, the silent phase looked hung. With cancel wiring that only reset run state, the HUD kept showing progress after Stop.

## Consequences

- Generators pass `enable_pbar=True` so upstream tqdm output reaches stderr.
- `ExtensionProcess._stderr_loop` reads char-by-char and treats both `\r` and `\n` as line terminators so tqdm's live `\r`-delimited ticks arrive in real time.
- The renderer extracts `<desc>: <pct>%|...` lines and renders them as `Generating / Decoding / Extracting / Loading (N%)`. Phase-boundary stamps (`[tag] pipeline.return elapsed=Xs`) land in the file log, not the HUD.
- The last step-callback fire updates the HUD top-line to a short next-phase label (e.g. `"Decoding volume…"`). User-visible strings contain no implementation details, library names, or callback names.
- On cancel, the renderer clears `currentJob` and resets run state atomically. The UI does not wait for the backend kill.
- Errors in the HUD are copyable, selectable, and fit multi-line tracebacks.
- `print(..., file=sys.stderr, flush=True)` is the observability pipe for extensions. Lines matching the tqdm shape render in the HUD; other stderr goes to the log file only.
