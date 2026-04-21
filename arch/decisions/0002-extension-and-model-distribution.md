# 0002 Extension And Model Distribution

- Status: approved
- Date: 2026-04-21

## Decision

Model weights will remain separate from extension code by default.

Extensions should be small and installable independently from model payloads. Model downloads should fetch only the required subpaths for a given node. Local model-folder import remains a fallback path for advanced or recovery scenarios.

A single extension may expose multiple model nodes that share one generator implementation but differ in weights, target subfolder, and file filters. This is the mechanism used to offer speed/quality variants (for example, Hy3D2-mac's Base / Fast / Turbo).

## Context

Bundling large model weights into extension payloads makes extension install, update, and packaging inefficient. For Hy3D2 in particular, the shape checkpoint is large enough that coupling code and weights would make every extension update heavy and fragile.

Quality/speed variants of the same underlying model (Base / Fast / Turbo) should not require separate extensions or duplicated generator code. Treating variants as sibling nodes in one manifest keeps the code path identical and lets the user pick a variant at workflow time while keeping downloads per-variant.

## Consequences

- Extension repos contain code, manifests, setup, and lightweight assets only.
- Model nodes declare Hugging Face include filters via `hf_include_prefixes` (whitelist the subpaths to fetch), with `hf_skip_prefixes` available as a complementary blacklist.
- Each downloadable node declares a `download_check` path used to verify install success (see ADR 0004).
- Variant nodes in the same extension:
  - share a single generator class
  - target distinct `model_dir` subfolders so their weights don't collide
  - carry short, user-facing labels (for example, "Base", "Fast", "Turbo") that the workflow UI exposes as a variant selector on the placed node
- The subprocess extension runner selects the correct manifest node per variant (not implicitly node[0]), and the generator resolves its weights directory from that node's configuration.
- The manifest supports both shared and per-variant parameter configuration:
  - `params_schema` may be declared at the top level (shared across all nodes) or per node (overrides the top-level). Both the Python registry and the Electron manifest parser honor the per-node-with-top-level-fallback rule, so extensions written either way render param controls in the workflow UI.
  - `param_defaults` on a node overrides individual field defaults from the shared schema, so variants can ship tuned values (for example, Turbo ships `num_inference_steps: 5` to match its distilled training regime, and RAM-safe decode values for Apple Silicon).
  - The workflow runner merges the effective schema defaults (schema default ⊕ node overrides) under any user overrides at submission time, so Python receives the values displayed in the UI rather than an empty dict that silently falls back to generator-hardcoded defaults.
- The app supports:
  - normal remote download
  - local model-folder import fallback (honors `download_check`)
- Updating extension code does not require redistributing large checkpoints.
- Download UX and reliability are first-class concerns because weights are a separate lifecycle.
