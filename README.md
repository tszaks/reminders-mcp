# Reminders MCP

Local macOS MCP server for Apple Reminders with full list and reminder management.

## Scope

This server lets an MCP client read and mutate Apple Reminders data stored on your Mac, including:

- account discovery
- list discovery and management
- reminder listing, lookup, and search
- reminder create, update, move, complete, and delete
- one-step cleanup actions for completed reminders and duplicates

## Important Behavior

This server is intentionally powerful.

- destructive actions do not require a separate confirmation flag
- cleanup tools directly delete reminders
- use it only if you want fast, high-trust automation from your MCP client

## Prerequisites

- macOS with Apple Reminders
- Node.js 20+
- local access to reminders synced through iCloud or another Reminders-supported account

## Setup

```bash
cd /Users/tyler/Projects/MCP-Servers/reminders-mcp
npm install
npm run build
```

## MCP Configuration

Add this to your MCP config:

```json
{
  "mcpServers": {
    "reminders": {
      "command": "node",
      "args": [
        "/Users/tyler/Projects/MCP-Servers/reminders-mcp/dist/index.js"
      ]
    }
  }
}
```

## First Run Permissions

On first use, macOS may prompt for Automation access so `osascript` can control Reminders. Approve access for your MCP client environment.

## Tools

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

## Example Prompts

- "List my reminders due this week"
- "Create a reminder in Inbox to send the contract tomorrow at 9am"
- "Move that reminder to the Work list"
- "Clean up completed reminders in my Personal list"
- "Remove duplicate reminders from Inbox"

## Troubleshooting

If reads fail with a message like `Failed to read Reminders accounts and lists` or `Parameter is missing`:

1. Open `System Settings > Privacy & Security > Reminders`
2. Grant Reminders access to the app hosting your MCP client, such as Terminal, Ghostty, or Codex
3. If prompted separately, also allow Automation access for Reminders when macOS asks
4. Re-run the MCP tool after permissions are granted

If you see empty data on first run, launch Reminders once and try again after granting access.

## License

MIT
