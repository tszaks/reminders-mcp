# Reminders MCP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public-ready macOS MCP server that gives Codex full Apple Reminders management from the CLI.

**Architecture:** A TypeScript MCP server exposes Reminders tools over stdio and delegates all app automation to a JXA script executed through `osascript`. Input validation stays in the server layer, while list/reminder serialization and mutation logic live in the JXA module.

**Tech Stack:** Node.js 20+, TypeScript, `@modelcontextprotocol/sdk`, macOS Reminders automation via JXA.

---

### Task 1: Scaffold Project Metadata And Docs

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`

**Step 1: Add package metadata and scripts**
- Include build, typecheck, test, and start scripts.

**Step 2: Add TypeScript config**
- Configure strict ESM output to `dist`.

**Step 3: Add public-ready docs**
- Document setup, permissions, destructive behavior, and MCP config.

**Step 4: Commit**
- Commit the initial project scaffold and docs.

### Task 2: Add A Small Testable Surface First

**Files:**
- Create: `src/reminders-tooling.ts`
- Create: `src/reminders.ts`
- Create: `test/reminders-tooling.test.mjs`
- Create: `test/reminders-envelope.test.mjs`

**Step 1: Write the failing tests**
- Verify the public tool registry includes the expected tool names.
- Verify envelope parsing handles success and failure output correctly.

**Step 2: Run tests to verify they fail**
- Run `npm test` and confirm failure because the source modules do not exist yet.

**Step 3: Write the minimal implementation**
- Add tool metadata module and envelope parsing helper used by the bridge.

**Step 4: Run tests to verify they pass**
- Run `npm test` and confirm the new modules satisfy the tests.

**Step 5: Commit**
- Commit the tested scaffolding code.

### Task 3: Implement The Reminders JXA Bridge

**Files:**
- Modify: `src/reminders.ts`
- Create: `src/reminders-jxa.ts`

**Step 1: Write a failing bridge-level test if needed**
- Add coverage for parse behavior that the bridge depends on.

**Step 2: Implement JXA runner**
- Spawn `osascript -l JavaScript` with operation and payload env vars.

**Step 3: Implement read operations**
- Accounts, lists, reminder listing, reminder lookup, and search.

**Step 4: Implement write operations**
- List create/update/delete and reminder create/update/delete/complete/uncomplete/move.

**Step 5: Implement cleanup operations**
- Completed cleanup and duplicate cleanup in scoped list/all-list mode.

**Step 6: Run tests and typecheck**
- Confirm the earlier tests still pass and TypeScript stays clean.

**Step 7: Commit**
- Commit the bridge and JXA implementation.

### Task 4: Implement MCP Tool Registration

**Files:**
- Create: `src/index.ts`
- Modify: `src/reminders-tooling.ts`

**Step 1: Register all tools**
- Expose the full Reminders tool surface through MCP.

**Step 2: Add input validation**
- Required strings, optional booleans, integer bounds, and ISO date checks.

**Step 3: Wire handlers to bridge operations**
- Return JSON text results for consistency with the existing Apple MCP servers.

**Step 4: Run tests, typecheck, and build**
- Run `npm test`
- Run `npm run typecheck`
- Run `npm run build`

**Step 5: Commit**
- Commit the MCP server entrypoint and registry wiring.

### Task 5: Runtime Verification And Release Prep

**Files:**
- Modify: `README.md`
- Modify: `package.json`

**Step 1: Smoke test against local Reminders**
- Verify list reads and at least one create/update/delete flow if automation access is available.

**Step 2: Tighten README**
- Add example prompts, safety notes, and install instructions.

**Step 3: Prepare GitHub publishing**
- Ensure repository metadata points to the public repo name.

**Step 4: Commit**
- Commit release-ready docs and metadata.
