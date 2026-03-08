#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { AppleRemindersBridge } from './reminders.js';
import { TOOL_DEFINITIONS } from './reminders-tooling.js';

function textResult(text: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

function hasOwn(source: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, field);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing or invalid '${field}'`);
  }

  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }

  throw new Error(`Missing or invalid '${field}'`);
}

function optionalInt(
  value: unknown,
  field: string,
  minValue: number,
  maxValue: number,
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  let parsed: number | null = null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    parsed = Math.trunc(value);
  } else if (typeof value === 'string' && value.trim()) {
    parsed = Number.parseInt(value.trim(), 10);
  }

  if (parsed === null || !Number.isInteger(parsed)) {
    throw new Error(`Missing or invalid '${field}'`);
  }

  if (parsed < minValue || parsed > maxValue) {
    throw new Error(`'${field}' must be between ${minValue} and ${maxValue}`);
  }

  return parsed;
}

function optionalIsoString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) {
    throw new Error(`Missing or invalid '${field}'`);
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing or invalid '${field}'`);
  }

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`'${field}' must be a valid ISO date string`);
  }

  return value.trim();
}

function requireListReference(args: Record<string, unknown>, idField = 'list_id', nameField = 'list_name'): void {
  if (!optionalString(args[idField]) && !optionalString(args[nameField])) {
    throw new Error(`Provide '${idField}' or '${nameField}'`);
  }
}

function assignStringOrNull(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  field: string,
): void {
  if (!hasOwn(source, field)) return;

  const value = source[field];
  if (value === null) {
    target[field] = null;
    return;
  }

  if (typeof value !== 'string') {
    throw new Error(`Missing or invalid '${field}'`);
  }

  target[field] = value;
}

function assignIsoStringOrNull(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  field: string,
): void {
  if (!hasOwn(source, field)) return;

  const value = source[field];
  if (value === null) {
    target[field] = null;
    return;
  }

  target[field] = optionalIsoString(value, field);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const bridge = new AppleRemindersBridge();

const server = new Server(
  {
    name: 'reminders-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    switch (request.params.name) {
      case 'reminders_list_accounts': {
        const result = await bridge.execute('list_accounts', {});
        return textResult(formatJson(result));
      }

      case 'reminders_list_lists': {
        const result = await bridge.execute('list_lists', {
          account_id: optionalString(args.account_id),
          account_name: optionalString(args.account_name),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_list_reminders': {
        const payload: Record<string, unknown> = {
          account_id: optionalString(args.account_id),
          account_name: optionalString(args.account_name),
          list_id: optionalString(args.list_id),
          list_name: optionalString(args.list_name),
          completed: optionalBoolean(args.completed, 'completed'),
          limit: optionalInt(args.limit, 'limit', 1, 1000),
        };

        const result = await bridge.execute('list_reminders', payload);
        return textResult(formatJson(result));
      }

      case 'reminders_get_reminder': {
        const result = await bridge.execute('get_reminder', {
          reminder_id: requireString(args.reminder_id, 'reminder_id'),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_search_reminders': {
        const result = await bridge.execute('search_reminders', {
          query: requireString(args.query, 'query'),
          account_id: optionalString(args.account_id),
          account_name: optionalString(args.account_name),
          list_id: optionalString(args.list_id),
          list_name: optionalString(args.list_name),
          completed: optionalBoolean(args.completed, 'completed'),
          limit: optionalInt(args.limit, 'limit', 1, 1000),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_create_list': {
        const result = await bridge.execute('create_list', {
          name: requireString(args.name, 'name'),
          account_id: optionalString(args.account_id),
          account_name: optionalString(args.account_name),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_update_list': {
        requireListReference(args);
        const result = await bridge.execute('update_list', {
          list_id: optionalString(args.list_id),
          list_name: optionalString(args.list_name),
          name: requireString(args.name, 'name'),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_delete_list': {
        requireListReference(args);
        const result = await bridge.execute('delete_list', {
          list_id: optionalString(args.list_id),
          list_name: optionalString(args.list_name),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_create_reminder': {
        const payload: Record<string, unknown> = {
          title: requireString(args.title, 'title'),
          list_id: optionalString(args.list_id),
          list_name: optionalString(args.list_name),
        };

        assignStringOrNull(args, payload, 'body');
        assignIsoStringOrNull(args, payload, 'due_date');
        assignIsoStringOrNull(args, payload, 'all_day_due_date');
        assignIsoStringOrNull(args, payload, 'remind_me_date');

        if (hasOwn(args, 'priority')) {
          payload.priority = optionalInt(args.priority, 'priority', 0, 9);
        }

        if (hasOwn(args, 'flagged')) {
          payload.flagged = optionalBoolean(args.flagged, 'flagged');
        }

        const result = await bridge.execute('create_reminder', payload);
        return textResult(formatJson(result));
      }

      case 'reminders_update_reminder': {
        const payload: Record<string, unknown> = {
          reminder_id: requireString(args.reminder_id, 'reminder_id'),
        };

        if (hasOwn(args, 'title')) {
          payload.title = requireString(args.title, 'title');
        }

        assignStringOrNull(args, payload, 'body');
        assignIsoStringOrNull(args, payload, 'due_date');
        assignIsoStringOrNull(args, payload, 'all_day_due_date');
        assignIsoStringOrNull(args, payload, 'remind_me_date');

        if (hasOwn(args, 'priority')) {
          payload.priority = optionalInt(args.priority, 'priority', 0, 9);
        }

        if (hasOwn(args, 'flagged')) {
          payload.flagged = optionalBoolean(args.flagged, 'flagged');
        }

        if (hasOwn(args, 'completed')) {
          payload.completed = optionalBoolean(args.completed, 'completed');
        }

        const result = await bridge.execute('update_reminder', payload);
        return textResult(formatJson(result));
      }

      case 'reminders_delete_reminder': {
        const result = await bridge.execute('delete_reminder', {
          reminder_id: requireString(args.reminder_id, 'reminder_id'),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_complete_reminder': {
        const result = await bridge.execute('complete_reminder', {
          reminder_id: requireString(args.reminder_id, 'reminder_id'),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_uncomplete_reminder': {
        const result = await bridge.execute('uncomplete_reminder', {
          reminder_id: requireString(args.reminder_id, 'reminder_id'),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_move_reminder': {
        if (!optionalString(args.target_list_id) && !optionalString(args.target_list_name)) {
          throw new Error(`Provide 'target_list_id' or 'target_list_name'`);
        }

        const result = await bridge.execute('move_reminder', {
          reminder_id: requireString(args.reminder_id, 'reminder_id'),
          target_list_id: optionalString(args.target_list_id),
          target_list_name: optionalString(args.target_list_name),
        });
        return textResult(formatJson(result));
      }

      case 'reminders_cleanup_completed': {
        const payload: Record<string, unknown> = {
          list_id: optionalString(args.list_id),
          list_name: optionalString(args.list_name),
        };

        if (hasOwn(args, 'before')) {
          payload.before = optionalIsoString(args.before, 'before');
        }

        const result = await bridge.execute('cleanup_completed', payload);
        return textResult(formatJson(result));
      }

      case 'reminders_cleanup_duplicates': {
        const result = await bridge.execute('cleanup_duplicates', {
          list_id: optionalString(args.list_id),
          list_name: optionalString(args.list_name),
        });
        return textResult(formatJson(result));
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return textResult(JSON.stringify({ ok: false, error: message }, null, 2));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
