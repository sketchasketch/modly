# 0005 Subprocess Lifecycle And Memory Release

- Status: approved
- Date: 2026-04-21

## Decision

Extension subprocesses are owned by Modly's process tree end-to-end, and "release memory" means "kill the process".

- The Python FastAPI bridge is spawned as the leader of its own Unix process group. Every extension subprocess it spawns inherits that group.
- On app quit, unload-all, or cancel-past-grace, Modly hard-kills (SIGKILL) the entire process group. No cooperative shutdown is relied on for memory release.
- Closing the Modly window quits the app on all platforms — including macOS. Modly does not live in the Dock after its window is closed.

## Context

On Apple Silicon, Metal wired memory (weights held for MPS inference) is not reliably returned to the OS by `torch.mps.empty_cache()` or Python garbage collection. It is only released when the owning process exits. "Free memory" therefore cannot be a cooperative operation — the only option that actually frees memory is terminating the subprocess.

Cooperative shutdown via stdin messaging also fails in the worst case that matters most: the subprocess is blocked inside a native call (volume decoding, marching cubes, VAE decode) and is not reading stdin. A polite "shutdown" or "cancel" message sits in the buffer while the user stares at a stuck UI.

Separately, Unix subprocesses that survive their parent are reparented to launchd/init and keep running. Without a shared process group, SIGKILLing the bridge leaves its extension subprocesses alive, holding the wired memory the user was trying to free. A previous implementation of this path left python3.11 processes running in the background after app quit.

The Mac default of "window close ≠ app quit" is also wrong for this app — Modly holds multi-GB Python subprocesses. Leaving them running when the user has closed the window surprises the user and defeats the purpose of a Free Memory action elsewhere.

## Consequences

- `child_process.spawn` for the Python bridge uses `detached: true` on Unix to make the bridge the leader of its own process group.
- `PythonBridge.stop()` sends `process.kill(-pid, 'SIGKILL')` to the negative PID on Unix — the kernel delivers SIGKILL to every process in the group. On Windows the equivalent is `taskkill /T /F`.
- `ExtensionProcess.stop()` (used by unload-all / Free Memory) SIGKILLs the subprocess directly. No stdin "shutdown" handshake, no 15 s wait. Each stop completes in tens of milliseconds; a three-variant user can have all subprocesses gone well within the 10 s HTTP timeout.
- Cancel during generation: the subprocess is given a 3 s grace period to acknowledge a cooperative cancel (so generators with frequent `cancel_event` checks can exit cleanly), after which the parent hard-kills it. The next generation reloads the model (~10 s) — that cost is accepted as the price of a cancel that actually works.
- `app.on('window-all-closed')` calls `app.quit()` on all platforms. Closing the Modly window means quit on macOS too.
- `app.on('before-quit')` runs `pythonBridge.stop()` before allowing the app to exit, so the process-group kill always fires on normal quit paths.
- Killing a loaded subprocess invalidates the registry's cached generator state: `_loaded` goes false, `_proc` goes None, and `get_active()`'s next call relaunches the subprocess and reloads the model.
- Extension authors can assume their subprocess will be killed without warning. Any cleanup that must happen (temp files, caches) belongs on the filesystem-visible side, not inside a graceful-shutdown handler.
