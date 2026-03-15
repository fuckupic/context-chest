import { loadCredentials, isTokenExpired } from './auth';
import { ContextChestClient } from './client';
import { deriveWrappingKey, unwrapMasterKey, decryptL2Legacy, encryptL2, sha256 } from './crypto';
import { DEFAULT_API_URL } from './config';

interface MemoryListItem {
  uri: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
  encryptionVersion?: number;
}

export async function migrateV2() {
  console.log('\n  Context Chest — v0.2 Migration\n');
  console.log('  Re-encrypting all memories with per-chest key derivation.');
  console.log('  Chest: "default"\n');

  const creds = loadCredentials();
  if (!creds) {
    console.error('  No credentials found. Run `context-chest login` first.');
    process.exit(1);
  }

  if (isTokenExpired(creds.jwt) && !creds.refreshToken) {
    console.error('  Token expired. Run `context-chest login` first.');
    process.exit(1);
  }

  const client = new ContextChestClient({
    baseUrl: creds.apiUrl || DEFAULT_API_URL,
    token: creds.jwt,
    refreshToken: creds.refreshToken,
    chestName: 'default',
  });

  let masterKey: Buffer;
  try {
    const wrappedMK = await client.getMasterKey();
    const exportKeyBuf = Buffer.from(creds.exportKey!, 'hex');
    const wrappingKey = deriveWrappingKey(exportKeyBuf, creds.userId!);
    masterKey = unwrapMasterKey(wrappedMK, wrappingKey);
  } catch (err) {
    console.error(`  Failed to unwrap master key: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log('  Authenticated. Fetching memories...\n');

  // Paginate through ALL memories
  let page = 1;
  const allMemories: MemoryListItem[] = [];
  while (true) {
    const result = await client.listMemories(page, 100);
    const items = result.data as MemoryListItem[];
    allMemories.push(...items);
    if (allMemories.length >= result.meta.total) break;
    page++;
  }

  console.log(`  Found ${allMemories.length} memories to migrate.\n`);

  let migrated = 0;
  let failed = 0;
  let skipped = 0;

  for (const mem of allMemories) {
    // Skip already-migrated memories
    if (mem.encryptionVersion === 2) {
      skipped++;
      continue;
    }

    try {
      const encryptedBuf = await client.getContent(mem.uri);
      const encryptedBase64 = encryptedBuf.toString('base64');

      let plaintext: Buffer;
      try {
        plaintext = decryptL2Legacy(masterKey, mem.uri, encryptedBase64);
      } catch {
        console.log(`  [SKIP] ${mem.uri} — cannot decrypt with v0.1 scheme`);
        skipped++;
        continue;
      }

      const newEncrypted = encryptL2(masterKey, 'default', mem.uri, plaintext);
      const newHash = sha256(Buffer.from(newEncrypted, 'base64'));

      await client.updateContent(mem.uri, newEncrypted, newHash, 2);

      migrated++;
      console.log(`  [OK] ${mem.uri}`);
    } catch (err) {
      failed++;
      console.error(`  [FAIL] ${mem.uri}: ${(err as Error).message}`);
    }
  }

  console.log(`\n  Migration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed.\n`);
}
