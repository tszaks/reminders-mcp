import { spawn } from 'node:child_process';
import { REMINDERS_JXA_SCRIPT } from './reminders-jxa.js';

interface JxaEnvelope {
  ok: boolean;
  result?: unknown;
  error?: string;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '').trim();
}

function extractEnvelopeText(value: string): string {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const candidate = lines[index];
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      return candidate;
    }
  }

  return value;
}

export function parseJxaEnvelope<T>(
  stdout: string,
  stderr: string,
  exitCode: number | null,
  serviceName: string,
): T {
  const output = stripAnsi(stdout);
  const errorOutput = stripAnsi(stderr);
  const envelopeText = extractEnvelopeText(output || errorOutput);

  if (exitCode !== 0) {
    throw new Error(errorOutput || output || `osascript exited with code ${exitCode}`);
  }

  if (!envelopeText) {
    throw new Error(errorOutput || `No output returned from ${serviceName} automation.`);
  }

  let envelope: JxaEnvelope;
  try {
    envelope = JSON.parse(envelopeText) as JxaEnvelope;
  } catch {
    throw new Error(`Failed to parse ${serviceName} output: ${envelopeText}`);
  }

  if (!envelope.ok) {
    throw new Error(envelope.error || `Unknown ${serviceName} automation error.`);
  }

  return envelope.result as T;
}

export class AppleRemindersBridge {
  async execute<T>(
    operation: string,
    payload: Record<string, unknown>,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    const { stdout, stderr, exitCode } = await this.runJxa(operation, payload, options?.timeoutMs);
    return parseJxaEnvelope<T>(stdout, stderr, exitCode, 'Reminders');
  }

  private runJxa(
    operation: string,
    payload: Record<string, unknown>,
    timeoutMs = 120_000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      const child = spawn('osascript', ['-l', 'JavaScript'], {
        env: {
          ...process.env,
          MCP_REMINDERS_OPERATION: operation,
          MCP_REMINDERS_PAYLOAD: JSON.stringify(payload ?? {}),
        },
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new Error(`Reminders automation timed out after ${timeoutMs}ms for operation '${operation}'.`));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code });
      });

      child.stdin.write(REMINDERS_JXA_SCRIPT);
      child.stdin.end();
    });
  }
}
