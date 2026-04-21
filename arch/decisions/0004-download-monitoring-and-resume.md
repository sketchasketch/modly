# 0004 Download Monitoring And Resume

- Status: approved
- Date: 2026-04-21

## Decision

Model download behavior must be observable and resilient.

Approved requirements:
- show the current file being transferred
- show byte-level progress where possible
- distinguish active transfer from stalled transfer
- fail out instead of hanging indefinitely
- support resuming from partial `.part` files when the remote server supports ranged downloads
- resume must follow redirects correctly: the `Range` header is sent against the resolved final URL (HF → CDN), not the original request URL, because some upstream servers silently drop `Range` across a redirect and return the full file
- "installed" state is verified by a node-declared `download_check` (a relative file path under the model dir) rather than "folder exists and is non-empty", so a partially-downloaded or failed install is never mistakenly surfaced as Ready

## Context

The original Hugging Face download path was too opaque for large checkpoint downloads. The UI could appear frozen at a small file like `config.yaml` while a large checkpoint was either downloading silently or stalled. That made support and runtime debugging unnecessarily difficult.

Two follow-on bugs drove the tightened contract above:

- Resume against HF URLs sometimes re-downloaded the full checkpoint. Root cause: `Range` was sent against the pre-redirect URL and was discarded during the CDN redirect. The fix is to resolve the final download URL first and send `Range` directly against it.
- A model directory left behind from a failed or partial download looked "installed" to the UI because the check was "folder exists and is non-empty". This produced false-Ready states on cards. The fix is a per-node `download_check` path that must exist for Ready.

## Consequences

- Backend download logic emits richer progress events.
- Renderer/UI surfaces file name, bytes downloaded, and stall state.
- Timeouts are part of the normal downloader contract.
- Partial downloads are preserved for retry/resume instead of being discarded by default.
- Resume is redirect-aware by contract; any new download endpoint that may redirect must resolve the final URL before issuing a ranged request.
- Every downloadable node should declare a `download_check` pointing at a required artifact (for example, the main weights file); missing `download_check` falls back to a folder-nonempty heuristic and should be treated as a manifest gap to fix, not a long-term state.
- Local folder import remains available as a fail-safe, not the primary distribution strategy. Imports honor the same `download_check` contract so imported folders that are missing the required file are not marked Ready.
