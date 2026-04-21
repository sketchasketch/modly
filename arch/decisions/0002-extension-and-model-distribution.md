# 0002 Extension And Model Distribution

- Status: approved
- Date: 2026-04-21

## Decision

Model weights stay separate from extension code. Extensions are code + manifest + setup; weights are downloaded per-node at runtime or imported from a local folder.

A single extension may expose multiple model nodes that share one generator implementation but differ in weights, subfolder, and filters — the mechanism for speed/quality variants (e.g. Hy3D2-mac Base/Fast/Turbo).

## Context

Bundling multi-GB checkpoints into extension payloads makes install, update, and packaging fragile. Variants of the same model don't warrant separate extensions or duplicated generator code.

## Consequences

- Extension repos contain code, manifests, setup scripts, and lightweight assets only.
- Model nodes declare `hf_include_prefixes` (whitelist) and optionally `hf_skip_prefixes` (blacklist).
- Each downloadable node declares a `download_check` path (see ADR 0004).
- Variant nodes share a generator class, target distinct `model_dir` subfolders, and carry short labels (e.g. "Base", "Fast", "Turbo") exposed as a variant selector on the placed workflow node.
- The runner resolves the correct manifest node from the `MODEL_DIR` env var's trailing path component, not `nodes[0]`.
- `params_schema` may be declared per-node or at the top level (shared). Both the Python registry and the Electron parser honor per-node-with-top-level-fallback.
- `param_defaults` on a node overrides individual schema defaults for that variant.
- The workflow runner merges schema defaults under user overrides at submission so Python receives the values the UI displays, not an empty dict.
- Supported flows: remote HF download and local folder import (both honor `download_check`).
