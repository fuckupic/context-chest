#!/usr/bin/env node
import { createInterface } from 'readline';
import { saveCredentials } from './auth';
import { deriveWrappingKey, unwrapMasterKey, generateMasterKey, wrapMasterKey } from './crypto';
import { DEFAULT_API_URL } from './config';

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      process.stdout.write(question);
      let input = '';
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf-8');
      const onData = (char: string) => {
        if (char === '\n' || char === '\r') {
          process.stdin.setRawMode?.(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          process.exit(0);
        } else if (char === '\u007F') {
          input = input.slice(0, -1);
        } else {
          input += char;
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function login() {
  console.log('\n  Context Chest — Login\n');

  const apiUrl = await prompt(`  API URL [${DEFAULT_API_URL}]: `);
  const baseUrl = apiUrl || DEFAULT_API_URL;
  const email = await prompt('  Email: ');
  const password = await prompt('  Password: ', true);

  if (!email || !password) {
    console.error('  Email and password required.');
    process.exit(1);
  }

  console.log('\n  Authenticating...');

  const loginRes = await fetch(`${baseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.json().catch(() => ({ message: `HTTP ${loginRes.status}` }));
    console.error(`  Login failed: ${(err as Record<string, string>).message}`);
    process.exit(1);
  }

  const loginData = (await loginRes.json()) as {
    token: string;
    refreshToken?: string;
    userId: string;
    exportKey: string;
  };

  // Fetch or create master key
  const authedHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loginData.token}`,
  };

  const mkRes = await fetch(`${baseUrl}/v1/auth/master-key`, { headers: authedHeaders });

  let masterKeyHex: string;

  if (mkRes.ok) {
    // Existing user — unwrap master key to verify it works
    const mkData = (await mkRes.json()) as { encryptedMasterKey: string };
    const exportKeyBuf = Buffer.from(loginData.exportKey, 'hex');
    const wrappingKey = deriveWrappingKey(exportKeyBuf, loginData.userId);
    try {
      const mk = unwrapMasterKey(mkData.encryptedMasterKey, wrappingKey);
      masterKeyHex = mk.toString('hex');
    } catch {
      console.error('  Failed to unwrap master key. Wrong password?');
      process.exit(1);
    }
  } else {
    // New user — generate and upload master key
    console.log('  Generating master key...');
    const mk = generateMasterKey();
    const exportKeyBuf = Buffer.from(loginData.exportKey, 'hex');
    const wrappingKey = deriveWrappingKey(exportKeyBuf, loginData.userId);
    const wrapped = wrapMasterKey(mk, wrappingKey);

    const putRes = await fetch(`${baseUrl}/v1/auth/master-key`, {
      method: 'PUT',
      headers: authedHeaders,
      body: JSON.stringify({ encryptedMasterKey: wrapped }),
    });

    if (!putRes.ok) {
      console.error('  Failed to store master key.');
      process.exit(1);
    }

    masterKeyHex = mk.toString('hex');
  }

  // Fetch wrapped MK for storage
  const wrappedRes = await fetch(`${baseUrl}/v1/auth/master-key`, { headers: authedHeaders });
  const wrappedData = (await wrappedRes.json()) as { encryptedMasterKey: string };

  saveCredentials({
    jwt: loginData.token,
    refreshToken: loginData.refreshToken,
    wrappedMasterKey: wrappedData.encryptedMasterKey,
    exportKey: loginData.exportKey,
    userId: loginData.userId,
    apiUrl: baseUrl,
  });

  console.log(`  Logged in as ${email}`);
  console.log(`  Credentials saved to ~/.context-chest/credentials.json`);
  console.log(`  API: ${baseUrl}\n`);
  console.log('  Now add to your Claude Code / Cursor MCP config:');
  console.log(`
  {
    "mcpServers": {
      "context-chest": {
        "command": "npx",
        "args": ["@context-chest/mcp-server"]
      }
    }
  }
  `);
}

const command = process.argv[2];

if (command === 'login') {
  login().catch((err) => {
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  });
} else {
  console.log(`
  Context Chest CLI

  Commands:
    context-chest login    Authenticate and save credentials

  Usage:
    npx @context-chest/mcp-server login
  `);
}
