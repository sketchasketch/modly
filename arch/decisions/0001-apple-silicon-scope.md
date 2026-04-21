# 0001 Apple Silicon Scope

- Status: approved
- Date: 2026-04-21

## Decision

macOS support targets Apple Silicon (arm64) only.

Out of scope:
- Intel macOS
- universal binaries
- Rosetta 2 fallback

## Context

Reducing to one architecture lets the native stack, Python packaging, and runtime assumptions stabilize without a compatibility matrix.

## Consequences

- Packaging is arm64-only on macOS.
- Native extension setup assumes Apple Silicon toolchains and MPS.
- Any Mac-specific workflow or extension optimizes for Apple Silicon memory and runtime first.
