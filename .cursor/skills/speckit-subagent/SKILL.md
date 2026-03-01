---
name: speckit-subagent
description: Runs spec-kit workflows in a subagent with bounded context. Use when the user invokes /speckit.specify, /speckit.clarify, /speckit.plan, /speckit.tasks, /speckit.checklist, /speckit.analyze, /speckit.implement, or /speckit.constitution, or when they ask to run a spec-driven phase (specify, clarify, plan, tasks, checklist, analyze, implement, constitution).
---

# Spec-kit subagent

Run spec-kit commands in a subagent so only `.specify/`, `specs/`, and the command file are in scope. This limits context spillover. If there are simple unambiguous fixes, make the edits directly.

## Instructions

1. **Identify the command and arguments**
   - From the user message, determine which spec-kit command was invoked (e.g. `speckit.plan`, `speckit.specify`) and the raw arguments (e.g. feature description, or empty).

2. **Load the command instructions**
   - Read the corresponding command file: `.cursor/commands/speckit.<name>.md` (e.g. `.cursor/commands/speckit.plan.md`).
   - Use its content as the source of truth for what the subagent must do.

3. **Call `mcp_task`**
   - **subagent_type**: `generalPurpose`
   - **prompt**: A single, self-contained task description that includes all of the following:
     - **Command and args**: "The user invoked /speckit.<name> with arguments: <user arguments or 'none'>."
     - **Instructions**: Either paste the full instructions from the command file, or state: "Follow every step in the command file at .cursor/commands/speckit.<name>.md. Read that file first; it defines the full workflow."
     - **Context boundary** (include verbatim for non-implement commands):
       - "Only read and modify files under `.specify/`, `specs/`, and the current feature directory. Do not search or open files under `src/`, `node_modules/`, or other application code."
     - **Context boundary for speckit.implement only**: Use the same primary context, then add: "You may open and edit source files only when implementing a concrete task from tasks.md; keep primary context in specs/ and .specify/."
     - **Key paths** (optional but helpful): "Relevant paths: .specify/memory/constitution.md, .specify/templates/, and the feature spec directory under specs/ (e.g. specs/NNN-<short-name>/)."
     - **Checklist upkeep**: "When FEATURE_DIR/checklists/requirements.md exists, update it as you go: mark items [x] when your work satisfies them, refresh the Notes section, and run this at natural checkpoints (e.g. after completing a phase or before reporting)."

4. **After the subagent returns**
   - Summarize the result for the user (what was created or updated, paths, branch if applicable).
   - If the command file or subagent output suggests a next step (e.g. handoff to another spec-kit command), tell the user: e.g. "Next you can run /speckit.plan" or "Run /speckit.tasks to break the plan into tasks."

## Context boundary summary

| Commands | Primary context | Beyond that |
|----------|-----------------|-------------|
| specify, clarify, plan, tasks, checklist, analyze, constitution | `.specify/`, `specs/`, `.cursor/commands/speckit.*.md` | None. Scripts under `.specify/scripts/` may run; do not open app source. |
| implement | Same + plan.md, tasks.md, checklists | Open/edit `src/` and project files only when executing a task from tasks.md. |
