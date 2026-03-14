import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface Credentials {
  jwt: string;
  wrappedMasterKey: string;
  apiUrl: string;
}

const CONFIG_DIR = join(homedir(), '.context-chest');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');

export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_FILE)) {
    return null;
  }
  const raw = readFileSync(CREDENTIALS_FILE, 'utf-8');
  return JSON.parse(raw) as Credentials;
}

export function saveCredentials(credentials: Credentials): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    writeFileSync(CREDENTIALS_FILE, '', { mode: 0o600 });
  }
}

export function isTokenExpired(jwt: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}
