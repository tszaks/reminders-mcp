#!/usr/bin/env node
// reminders-mcp HTTP server — Express + StreamableHTTP transport wrapper
// Runs on the Mac, exposes all reminders tools over authenticated HTTP.
// ENV: PORT (default 3001), MCP_API_KEY (required), BASE_PATH (optional)
//
// Build: npm run build
// Start: MCP_API_KEY=your-key PORT=3001 node dist/http-server.js
// Expose: cloudflared tunnel --url http://localhost:3001

import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AppleRemindersBridge } from './reminders.js';

const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0';
const VERSION = '1.0.0';
const MCP_API_KEY = process.env.MCP_API_KEY;
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

if (!MCP_API_KEY) throw new Error('Missing required env var: MCP_API_KEY');

const bridge = new AppleRemindersBridge();

function textResult(text: string) { return { content: [{ type: 'text' as const, text }] }; }
function jsonResult(v: unknown) { return textResult(JSON.stringify(v, null, 2)); }
function wrap<T>(fn: () => Promise<T>) { return fn().catch((e: unknown) => textResult(`Error: ${e instanceof Error ? e.message : String(e)}`)); }

function requireBearer(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (req.headers.authorization !== `Bearer ${MCP_API_KEY}`) { res.status(401).json({ error: 'Unauthorized' }); return; }
  next();
}

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') return '';
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function createServer() {
  const server = new McpServer({ name: 'reminders-mcp', version: VERSION }, { capabilities: { logging: {} } });

  server.registerTool('reminders_list_accounts', { title: 'List Reminders Accounts', description: 'List Apple Reminders accounts available on this Mac.', inputSchema: {} }, async () => wrap(() => bridge.execute('list_accounts', {}).then(jsonResult)));

  server.registerTool('reminders_list_lists', { title: 'List Reminder Lists', description: 'List reminder lists, optionally scoped by account.', inputSchema: { account_id: z.string().optional(), account_name: z.string().optional() } }, async (args) => wrap(() => bridge.execute('list_lists', args).then(jsonResult)));

  server.registerTool('reminders_list_reminders', { title: 'List Reminders', description: 'List reminders with optional filters.', inputSchema: { account_id: z.string().optional(), account_name: z.string().optional(), list_id: z.string().optional(), list_name: z.string().optional(), completed: z.boolean().optional(), limit: z.number().int().min(1).max(1000).optional() } }, async (args) => wrap(() => bridge.execute('list_reminders', args).then(jsonResult)));

  server.registerTool('reminders_get_reminder', { title: 'Get Reminder', description: 'Get a single reminder by reminder_id.', inputSchema: { reminder_id: z.string() } }, async ({ reminder_id }) => wrap(() => bridge.execute('get_reminder', { reminder_id }).then(jsonResult)));

  server.registerTool('reminders_search_reminders', { title: 'Search Reminders', description: 'Search reminders by text across titles and notes.', inputSchema: { query: z.string(), account_id: z.string().optional(), account_name: z.string().optional(), list_id: z.string().optional(), list_name: z.string().optional(), completed: z.boolean().optional(), limit: z.number().int().min(1).max(1000).optional() } }, async (args) => wrap(() => bridge.execute('search_reminders', args).then(jsonResult)));

  server.registerTool('reminders_create_list', { title: 'Create Reminder List', description: 'Create a reminder list.', inputSchema: { name: z.string(), account_id: z.string().optional(), account_name: z.string().optional() } }, async (args) => wrap(() => bridge.execute('create_list', args).then(jsonResult)));

  server.registerTool('reminders_update_list', { title: 'Update Reminder List', description: 'Update a reminder list name.', inputSchema: { name: z.string(), list_id: z.string().optional(), list_name: z.string().optional() } }, async (args) => wrap(() => bridge.execute('update_list', args).then(jsonResult)));

  server.registerTool('reminders_delete_list', { title: 'Delete Reminder List', description: 'Delete a reminder list.', inputSchema: { list_id: z.string().optional(), list_name: z.string().optional() } }, async (args) => wrap(() => bridge.execute('delete_list', args).then(jsonResult)));

  server.registerTool('reminders_create_reminder', { title: 'Create Reminder', description: 'Create a reminder in a selected or default list.', inputSchema: { title: z.string(), body: z.string().nullable().optional(), list_id: z.string().optional(), list_name: z.string().optional(), due_date: z.string().nullable().optional(), all_day_due_date: z.string().nullable().optional(), remind_me_date: z.string().nullable().optional(), priority: z.number().int().min(0).max(9).optional(), flagged: z.boolean().optional() } }, async (args) => wrap(() => bridge.execute('create_reminder', args).then(jsonResult)));

  server.registerTool('reminders_update_reminder', { title: 'Update Reminder', description: 'Update one or more reminder fields.', inputSchema: { reminder_id: z.string(), title: z.string().optional(), body: z.string().nullable().optional(), due_date: z.string().nullable().optional(), all_day_due_date: z.string().nullable().optional(), remind_me_date: z.string().nullable().optional(), priority: z.number().int().min(0).max(9).optional(), flagged: z.boolean().optional(), completed: z.boolean().optional() } }, async (args) => wrap(() => bridge.execute('update_reminder', args).then(jsonResult)));

  server.registerTool('reminders_delete_reminder', { title: 'Delete Reminder', description: 'Delete a reminder.', inputSchema: { reminder_id: z.string() } }, async ({ reminder_id }) => wrap(() => bridge.execute('delete_reminder', { reminder_id }).then(jsonResult)));

  server.registerTool('reminders_complete_reminder', { title: 'Complete Reminder', description: 'Mark a reminder complete.', inputSchema: { reminder_id: z.string() } }, async ({ reminder_id }) => wrap(() => bridge.execute('complete_reminder', { reminder_id }).then(jsonResult)));

  server.registerTool('reminders_uncomplete_reminder', { title: 'Uncomplete Reminder', description: 'Mark a reminder incomplete.', inputSchema: { reminder_id: z.string() } }, async ({ reminder_id }) => wrap(() => bridge.execute('uncomplete_reminder', { reminder_id }).then(jsonResult)));

  server.registerTool('reminders_move_reminder', { title: 'Move Reminder', description: 'Move a reminder to another list.', inputSchema: { reminder_id: z.string(), target_list_id: z.string().optional(), target_list_name: z.string().optional() } }, async (args) => wrap(() => bridge.execute('move_reminder', args).then(jsonResult)));

  server.registerTool('reminders_cleanup_completed', { title: 'Cleanup Completed', description: 'Delete completed reminders in scope.', inputSchema: { list_id: z.string().optional(), list_name: z.string().optional(), before: z.string().optional() } }, async (args) => wrap(() => bridge.execute('cleanup_completed', args).then(jsonResult)));

  server.registerTool('reminders_cleanup_duplicates', { title: 'Cleanup Duplicates', description: 'Delete duplicate reminders and keep the oldest.', inputSchema: { list_id: z.string().optional(), list_name: z.string().optional() } }, async (args) => wrap(() => bridge.execute('cleanup_duplicates', args).then(jsonResult)));

  return server;
}

const app = express();
const transports = new Map<string, StreamableHTTPServerTransport>();
const router = express.Router();
app.use(express.json({ limit: '2mb' }));
router.get('/healthz', (_req, res) => res.json({ ok: true, name: 'reminders-mcp', version: VERSION }));
router.use('/mcp', requireBearer);
router.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId && transports.has(sessionId)) { await transports.get(sessionId)!.handleRequest(req, res, req.body); return; }
  if (!sessionId && isInitializeRequest(req.body)) {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized: (id) => { transports.set(id, transport); } });
    transport.onclose = () => { if (transport.sessionId) transports.delete(transport.sessionId); };
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }
  res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid session' }, id: null });
});
router.get('/mcp', async (req, res) => { const s = req.headers['mcp-session-id'] as string | undefined; if (s && transports.has(s)) { await transports.get(s)!.handleRequest(req, res); return; } res.status(400).send('Invalid session'); });
router.delete('/mcp', async (req, res) => { const s = req.headers['mcp-session-id'] as string | undefined; if (s && transports.has(s)) { await transports.get(s)!.handleRequest(req, res); return; } res.status(400).send('Invalid session'); });
app.use(router);
if (BASE_PATH) app.use(BASE_PATH, router);
app.listen(PORT, HOST, () => { console.log(`reminders-mcp HTTP server listening on ${HOST}:${PORT}${BASE_PATH || ''}/mcp`); });
