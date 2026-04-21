# 0001 Apple Silicon Scope

- Status: approved
- Date: 2026-04-21

## Decision

Modly macOS support will target Apple Silicon only for the current phase.

Explicitly out of scope for now:
- Intel macOS
- universal binaries
- Rosetta 2 fallback support

## Context

The native stack, Python packaging, and model/runtime assumptions are materially easier to stabilize when the target is reduced to one architecture. The current work is focused on getting real Mac functionality shipped, not maximizing platform coverage on the first pass.

## Consequences

- Packaging is arm64-only on macOS.
- Native extension setup can assume Apple Silicon toolchains and `mps`.
- Intel compatibility branches are deferred.
- Any Mac-specific workflow or extension support should optimize for Apple Silicon memory and runtime behavior first.
