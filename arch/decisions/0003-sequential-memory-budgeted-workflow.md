# 0003 Sequential Memory-Budgeted Workflow

- Status: approved
- Date: 2026-04-21

## Decision

The full Mac workflow will be designed as a sequential, memory-budgeted pipeline with explicit load and unload boundaries between heavy stages.

Target workflow direction:
- 4-view image generation
- shape generation
- mesh optimization
- UV unwrap
- texture generation

Only one heavy generative model should be resident at a time on a 16 GB Apple Silicon machine.

## Context

Apple Silicon uses unified memory. Allowing multiple large models or GPU-heavy stages to overlap is more likely to cause system-wide pressure, degraded performance, or outright workflow failure than on larger discrete-GPU setups.

The goal is a practical, stable full workflow on a 16 GB machine, not theoretical peak concurrency.

## Consequences

- Workflow stages hand off through files or other persisted artifacts.
- Heavy models are unloaded before the next heavy stage starts.
- CPU-first stages such as mesh optimization should avoid competing with generative models for memory.
- Preset quality modes should be tuned for realistic Apple Silicon constraints. Variant nodes ship RAM-safe `param_defaults` for 16 GB machines (for example, Hy3D2 Turbo defaults to `octree_resolution: 256` and `num_chunks: 4000` rather than the upstream 384 / 8000) — see ADR 0002.
- The app surfaces live system memory pressure in the top bar using macOS's "Memory Used" definition (`wired + active + compressed` from `vm_stat`, not the naive `total - free` which counts file-backed cache). Users watching a generation can see headroom in real time.
- Smart memory management is part of workflow orchestration, not an afterthought. Subprocess lifecycle is part of this — see ADR 0005.
