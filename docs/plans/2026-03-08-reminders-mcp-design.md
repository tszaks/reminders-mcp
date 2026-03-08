# Reminders MCP Design

## Scope
Build a local macOS MCP server that gives Codex full read/write access to Apple Reminders on this Mac, including reminder CRUD, list management, completion toggles, moves, search, and cleanup operations.

## Architecture
- Runtime: Node.js 20+
- MCP transport: stdio via `@modelcontextprotocol/sdk`
- Automation layer: `osascript -l JavaScript` (JXA)
- Server layout:
  - `src/index.ts` tool registry + argument validation
  - `src/reminders.ts` bridge runner for JXA execution
  - `src/reminders-jxa.ts` Reminders automation logic
  - `src/reminders-tooling.ts` shared tool metadata for testable registry behavior

## Tooling
- `reminders_list_accounts`
- `reminders_list_lists`
- `reminders_list_reminders`
- `reminders_get_reminder`
- `reminders_search_reminders`
- `reminders_create_list`
- `reminders_update_list`
- `reminders_delete_list`
- `reminders_create_reminder`
- `reminders_update_reminder`
- `reminders_delete_reminder`
- `reminders_complete_reminder`
- `reminders_uncomplete_reminder`
- `reminders_move_reminder`
- `reminders_cleanup_completed`
- `reminders_cleanup_duplicates`

## Data Model
- Account fields:
  - `id`
  - `name`
- List fields:
  - `id`
  - `name`
  - `account_id`
  - `account_name`
  - `color`
  - `emblem`
- Reminder fields:
  - `id`
  - `title`
  - `body`
  - `completed`
  - `completion_date`
  - `due_date`
  - `all_day_due_date`
  - `remind_me_date`
  - `priority`
  - `flagged`
  - `list_id`
  - `list_name`
  - `account_id`
  - `account_name`
  - `creation_date`
  - `modification_date`

## Behavior
- Reads can target all lists or a selected list.
- Reminder lookup prefers `reminder_id`, with optional scoped name matching when needed.
- Create writes to a chosen list or the Reminders default list.
- Update supports partial field changes.
- Move changes a reminder's list without changing its identifier contract for the caller.
- Cleanup operations are direct one-step mutations with no extra confirmation gate:
  - completed cleanup deletes completed reminders in scope
  - duplicate cleanup keeps the oldest reminder in each duplicate group and deletes the rest

## Safety
- This server is intentionally powerful and does not require an explicit confirm flag for destructive actions because the primary user wants one-step control from Codex.
- Public documentation will make the destructive behavior explicit so other users know the tradeoff before installing it.

## Public Packaging
- Publish with MIT license
- Include polished README with install steps, permissions note, MCP config, tool list, and example prompts
- Set repository metadata for public GitHub release
- Keep implementation small and dependency-light so it is easy to audit and share
