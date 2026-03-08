export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'reminders_list_accounts',
    description: 'List Apple Reminders accounts available on this Mac.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'reminders_list_lists',
    description: 'List reminder lists, optionally scoped by account.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string' },
        account_name: { type: 'string' },
      },
    },
  },
  {
    name: 'reminders_list_reminders',
    description: 'List reminders with optional list, account, and state filters.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string' },
        account_name: { type: 'string' },
        list_id: { type: 'string' },
        list_name: { type: 'string' },
        completed: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'reminders_get_reminder',
    description: 'Get a single reminder by reminder_id.',
    inputSchema: {
      type: 'object',
      properties: {
        reminder_id: { type: 'string' },
      },
      required: ['reminder_id'],
    },
  },
  {
    name: 'reminders_search_reminders',
    description: 'Search reminders by text across titles and notes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        account_id: { type: 'string' },
        account_name: { type: 'string' },
        list_id: { type: 'string' },
        list_name: { type: 'string' },
        completed: { type: 'boolean' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'reminders_create_list',
    description: 'Create a reminder list.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        account_id: { type: 'string' },
        account_name: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'reminders_update_list',
    description: 'Update a reminder list name.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['list_id', 'name'],
    },
  },
  {
    name: 'reminders_delete_list',
    description: 'Delete a reminder list.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string' },
      },
      required: ['list_id'],
    },
  },
  {
    name: 'reminders_create_reminder',
    description: 'Create a reminder in a selected or default list.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        list_id: { type: 'string' },
        list_name: { type: 'string' },
        due_date: { type: 'string' },
        all_day_due_date: { type: 'string' },
        remind_me_date: { type: 'string' },
        priority: { type: 'number' },
        flagged: { type: 'boolean' },
      },
      required: ['title'],
    },
  },
  {
    name: 'reminders_update_reminder',
    description: 'Update one or more reminder fields.',
    inputSchema: {
      type: 'object',
      properties: {
        reminder_id: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        due_date: { type: 'string' },
        all_day_due_date: { type: 'string' },
        remind_me_date: { type: 'string' },
        priority: { type: 'number' },
        flagged: { type: 'boolean' },
        completed: { type: 'boolean' },
      },
      required: ['reminder_id'],
    },
  },
  {
    name: 'reminders_delete_reminder',
    description: 'Delete a reminder.',
    inputSchema: {
      type: 'object',
      properties: {
        reminder_id: { type: 'string' },
      },
      required: ['reminder_id'],
    },
  },
  {
    name: 'reminders_complete_reminder',
    description: 'Mark a reminder complete.',
    inputSchema: {
      type: 'object',
      properties: {
        reminder_id: { type: 'string' },
      },
      required: ['reminder_id'],
    },
  },
  {
    name: 'reminders_uncomplete_reminder',
    description: 'Mark a reminder incomplete.',
    inputSchema: {
      type: 'object',
      properties: {
        reminder_id: { type: 'string' },
      },
      required: ['reminder_id'],
    },
  },
  {
    name: 'reminders_move_reminder',
    description: 'Move a reminder to another list.',
    inputSchema: {
      type: 'object',
      properties: {
        reminder_id: { type: 'string' },
        target_list_id: { type: 'string' },
        target_list_name: { type: 'string' },
      },
      required: ['reminder_id'],
    },
  },
  {
    name: 'reminders_cleanup_completed',
    description: 'Delete completed reminders in scope.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string' },
        list_name: { type: 'string' },
        before: { type: 'string' },
      },
    },
  },
  {
    name: 'reminders_cleanup_duplicates',
    description: 'Delete duplicate reminders in scope and keep the oldest reminder in each group.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string' },
        list_name: { type: 'string' },
      },
    },
  },
];
