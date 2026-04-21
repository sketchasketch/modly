# 0005 Subprocess Lifecycle And Memory Release

- Status: approved
- Date: 2026-04-21

## Decision

Extension subprocesses are owned by Modly's process tree end-to-end. "Release memory" means "kill the process".

- The Python bridge is spawned as the leader of its own Unix process group.
- On app quit, unload-all, or cancel-past-grace, Modly sends SIGKILL to the entire process group. No cooperative shutdown is relied on for memory release.
- Closing the Modly window quits the app on all platforms, including macOS.

## Context

On Apple Silicon, Metal wired memory is not reliably returned to the OS by `torch.mps.empty_cache()` or Python GC — only by process exit. Cooperative shutdown over stdin also fails when the subprocess is blocked in a native call (volume decode, marching cubes, VAE decode) and not reading stdin. Unix subprocesses without a shared process group are reparented to launchd on parent death and continue holding wired memory.

## Consequences

- `child_process.spawn` sets `detached: true` on non-Windows so the bridge leads its own process group.
- `PythonBridge.stop()` calls `process.kill(-pid, 'SIGKILL')` on Unix. Windows uses the existing `taskkill /T /F`.
- `ExtensionProcess.stop()` (unload-all / Free Memory) sends SIGKILL directly. No stdin handshake, no wait.
- Cancel during generation: 3 s cooperative grace for generators with `cancel_event` checks, then hard kill. Next generation reloads the model (~10 s).
- `app.on('window-all-closed')` calls `app.quit()` on all platforms.
- `app.on('before-quit')` runs `pythonBridge.stop()` before exit so the group kill fires on every normal quit.
- Killing a loaded subprocess clears `_loaded` and `_proc`; `get_active()`'s next call relaunches.
- Extension cleanup belongs on disk, not in a graceful-shutdown handler.
