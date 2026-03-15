/**
 * E2E tests — requires running PostgreSQL, MinIO, and OpenViking.
 *
 * The OPAQUE auth flow was refactored to server-only in Phase 1.
 * Full E2E tests with the new protocol require an OPAQUE client
 * implementation (Phase 2: MCP server). These placeholder tests
 * verify the test infrastructure works.
 *
 * Run with: npm run test:e2e (requires docker-compose up)
 */

describe('E2E Tests', () => {
  it.todo('should register a new user via OPAQUE protocol');
  it.todo('should complete registration and receive JWT');
  it.todo('should store and retrieve encrypted master key');
  it.todo('should upload and download vault blob');
  it.todo('should authorize a client with role-based grant');
  it.todo('should exchange consent code for grant token');
  it.todo('should introspect token and receive role + permissions');
  it.todo('should remember and recall a memory');
  it.todo('should create, append to, and close a session');
  it.todo('should enforce usage limits on free tier');
});
