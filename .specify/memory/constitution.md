<!--
  Sync Impact Report
  Version change: 1.1.0 → 1.2.0
  Modified principles: III (fork, minimal surface area)
  Added: Architecture doc reference (.specify/memory/whisper-plugin-architecture.md); fork and minimal-changes guidance
  Removed sections: None
  Templates: plan-template.md ✅; spec-template.md ✅; tasks-template.md ✅;
    commands/*.md N/A
  Follow-up TODOs: None

  Version change: 1.2.0 → 1.2.1
  Modified: Technical Constraints (Architecture bullet), Development Workflow
  Added: Architecture doc now includes external interfaces and behaviours; constitution references them in Technical Constraints and Development Workflow
  Removed sections: None
-->

# Obsidian Whisper Constitution

## Core Principles

### I. Obsidian-first

All features MUST be delivered as Obsidian plugin capabilities: commands, settings, ribbon/UI, and vault file operations. The plugin MUST use the official Obsidian API and MUST NOT require a separate backend or server. Rationale: the product is a community plugin; compatibility and UX are defined by Obsidian.

### II. User privacy and API safety

API keys MUST be stored and used in a way that avoids exposure (e.g. settings only in plugin scope, no logging of keys). Audio and transcriptions MUST be handled according to user-controlled options (e.g. save recording, save transcription). External API usage (e.g. OpenAI Whisper) MUST be documented and configurable (API URL, model). User-visible messages (e.g. Notice) MUST NOT include API keys, stack traces, or other sensitive or technical details; use short, safe messages and log details only to console or dev tools. Rationale: trust and safety for vault content and credentials.

### III. Simplicity and maintainability

The codebase MUST stay minimal: TypeScript, single plugin bundle, minimal dependencies. YAGNI applies; new dependencies or architectural complexity MUST be justified. This repository is a fork of an existing codebase; new changes and features MUST expose minimal changes to existing code and plugin class abstractions (e.g. prefer extending or adding modules over modifying core plugin classes). Rationale: easier maintenance, upgrades, and upstream alignment.

### IV. Conventional commits and versioning

All commit messages MUST follow conventional commit syntax. Release version MUST be kept in sync across manifest.json, package.json, versions.json (if present), and git tags. Release artifacts are main.js, manifest.json, and styles.css; this asset list and version sync MUST be maintained as in the release script (e.g. verify-and-update.mjs). Rationale: consistent history, changelogs, and release automation.

### V. Quality gates

Before release, the build MUST pass (TypeScript check and esbuild bundle). Linting and formatting (e.g. ESLint, Prettier) MUST be applied. Automated tests are not required; manual verification in Obsidian before release is required. Rationale: stable releases and consistent code style.

## Technical Constraints

- **Stack**: TypeScript; Obsidian plugin API; esbuild for bundling; axios for HTTP (or current deps as documented in package.json).
- **Scope**: Client-side plugin only; no separate backend or database.
- **Platform**: Obsidian desktop and mobile (minAppVersion as in manifest).
- **Release artifacts**: main.js, manifest.json, styles.css.
- **Architecture**: Plugin structure, class roles, and external interfaces and behaviours (public APIs, types, lifecycle, Obsidian API usage) are documented in `.specify/memory/whisper-plugin-architecture.md`; that doc is the single source of truth for what the plugin exposes and how components behave.

## Development Workflow

- Architecture, plugin structure, and external interfaces and behaviours are documented in `.specify/memory/whisper-plugin-architecture.md`. When planning changes (e.g. new features, local ASR), plans and PRs SHOULD consult that doc’s interfaces and behaviours to preserve minimal surface area, avoid breaking existing contracts, and keep Obsidian API usage consistent.
- New features SHOULD be specified via .specify flow: spec → plan → tasks. Constitution Check in the implementation plan MUST pass before Phase 0 research and after Phase 1 design.
- PRs and reviews SHOULD verify compliance with this constitution. Exceptions (e.g. new dependency, structural change) MUST be justified in the plan (e.g. Complexity Tracking table).
- Breaking changes (e.g. minAppVersion, config renames, removed features) MUST be documented in CHANGELOG and SHOULD trigger a MAJOR version bump.
- Use README and .specify documentation for runtime and contribution guidance.

## Governance

This constitution supersedes ad-hoc project practices. Amendments require: (1) updating this file with a version bump per semantic versioning (MAJOR: backward-incompatible principle removal or redefinition; MINOR: new principle or material expansion; PATCH: clarifications, typos), (2) updating LAST_AMENDED_DATE, and (3) documenting the change in the Sync Impact Report at the top of this file. All PRs that touch architecture or principles SHOULD confirm compliance with the constitution.

**Version**: 1.2.1 | **Ratified**: 2025-03-01 | **Last Amended**: 2025-03-01
