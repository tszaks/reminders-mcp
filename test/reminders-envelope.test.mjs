import test from 'node:test';
import assert from 'node:assert/strict';

import { parseJxaEnvelope } from '../dist/reminders.js';

test('parseJxaEnvelope returns the result for a successful envelope', () => {
  const result = parseJxaEnvelope('{"ok":true,"result":{"count":3}}', '', 0, 'Reminders');
  assert.deepEqual(result, { count: 3 });
});

test('parseJxaEnvelope throws the JXA error message for a failed envelope', () => {
  assert.throws(
    () => parseJxaEnvelope('{"ok":false,"error":"Boom"}', '', 0, 'Reminders'),
    /Boom/
  );
});

test('parseJxaEnvelope ignores preamble lines before the JSON envelope', () => {
  const result = parseJxaEnvelope(
    '2026-03-08 13:00:24.300 osascript[1:1] Connection invalid\n{"ok":true,"result":{"count":2}}',
    '',
    0,
    'Reminders'
  );

  assert.deepEqual(result, { count: 2 });
});
