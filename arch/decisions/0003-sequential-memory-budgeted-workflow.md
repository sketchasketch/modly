# 0003 Sequential Memory-Budgeted Workflow

- Status: approved
- Date: 2026-04-21

## Decision

The full Mac workflow is sequential with explicit load/unload boundaries between heavy stages. One heavy generative model is resident at a time on 16 GB Apple Silicon.

Target stages: 4-view image generation → shape generation → mesh optimization → UV unwrap → texture generation.

## Context

Apple Silicon uses unified memory. Overlapping heavy models or GPU stages on 16 GB produces system-wide pressure, degraded performance, or failure.

## Consequences

- Workflow stages hand off through files.
- Heavy models are unloaded before the next heavy stage starts.
- CPU-first stages (mesh optimization) don't compete with generative models for memory.
- Variant nodes ship RAM-safe `param_defaults` for 16 GB (e.g. Hy3D2 Turbo: `octree_resolution: 256`, `num_chunks: 4000`) — see ADR 0002.
- The top bar surfaces live memory pressure using `wired + active + compressed` from `vm_stat` (matches Activity Monitor), not `total − free`.
- Subprocess lifecycle is part of memory management — see ADR 0005.
