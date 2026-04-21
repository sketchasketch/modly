# 0004 Download Monitoring And Resume

- Status: approved
- Date: 2026-04-21

## Decision

Model downloads must be observable and resilient:

- Show current file, byte-level progress, and stall state.
- Fail out instead of hanging indefinitely.
- Resume from partial `.part` files when the server supports ranged requests.
- Send `Range` against the resolved final URL (HF → CDN), not the original, because some CDNs drop `Range` across redirects.
- Verify install via a node-declared `download_check` file path, not "folder exists and non-empty".

## Context

Large checkpoint downloads were opaque and could appear frozen on a small file while a large one transferred silently. Resume against the pre-redirect URL silently re-downloaded from zero. A partial directory left by a failed install surfaced as Ready.

## Consequences

- The backend emits progress events with file name, bytes downloaded, total bytes, and stall seconds.
- Timeouts are part of the downloader contract.
- Partial downloads are preserved as `.part` for retry.
- Resume resolves the final URL via a pre-flight GET, then issues the ranged request against it.
- Every downloadable node declares `download_check` pointing at a required artifact. Missing `download_check` falls back to folder-nonempty and is treated as a manifest gap.
- Local folder import honors `download_check` so imported folders missing the required file are not marked Ready.
