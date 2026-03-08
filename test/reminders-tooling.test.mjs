import test from 'node:test';
import assert from 'node:assert/strict';

import { TOOL_DEFINITIONS } from '../dist/reminders-tooling.js';

test('tool registry includes the expected public reminders tools', () => {
  const names = TOOL_DEFINITIONS.map((tool) => tool.name);

  assert.deepEqual(names, [
    'reminders_list_accounts',
    'reminders_list_lists',
    'reminders_list_reminders',
    'reminders_get_reminder',
    'reminders_search_reminders',
    'reminders_create_list',
    'reminders_update_list',
    'reminders_delete_list',
    'reminders_create_reminder',
    'reminders_update_reminder',
    'reminders_delete_reminder',
    'reminders_complete_reminder',
    'reminders_uncomplete_reminder',
    'reminders_move_reminder',
    'reminders_cleanup_completed',
    'reminders_cleanup_duplicates'
  ]);
});
