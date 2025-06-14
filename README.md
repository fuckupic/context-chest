# Context Chest - Sync & Connect API

Context Chest is a secure vault synchronization and connection API that allows users to backup their encrypted vaults and enables external applications to securely connect through OAuth2-like flows.

## Features

- Secure user authentication using OPAQUE protocol
- Encrypted vault blob storage (AES-GCM 256)
- Chest Connect OAuth2-like flow for external applications
- Rate limiting and security measures
- Prometheus metrics and Grafana dashboards

## Prerequisites

- Node.js 20 or later
- Docker and Docker Compose
- PostgreSQL 15 or later (for production)
- S3-compatible storage (MinIO for development, AWS S3 for production)

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/context-chest.git
   cd context-chest
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration.

4. Start development services:
   ```bash
   docker-compose up -d
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## API Documentation

The API documentation is available at `/docs` when running the server. The OpenAPI specification is in `openapi.yaml`.

## Security Considerations

- The server never sees plaintext profile data
- All vault data is encrypted client-side using AES-GCM 256
- OPAQUE protocol for password-based authentication
- Ed25519 for JWT signatures
- Rate limiting and request size restrictions
- TLS 1.3 required for all connections

## OPAQUE Integration

Context Chest uses the OPAQUE protocol for secure password-based authentication. The integration is based on the `@cloudflare/opaque-ts` library.

### How It Works

1. **Registration:**
   - The client initiates registration by sending a registration request.
   - The server responds with a registration response, which is stored in the database.
   - The client completes the registration process, and the server stores the OPAQUE record.

2. **Login:**
   - The client initiates login by sending a credential request.
   - The server responds with a credential response, which is used to verify the client's credentials.
   - The client sends a credential finalization, and the server verifies it to complete the login process.

### Implementation Details

- The server uses a persistent `serverPrivateKey` for OPAQUE operations.
- The OPAQUE record is stored in the database as a `bytea` field.
- The integration ensures that the server never sees the plaintext password, enhancing security.

## Development

### Running Tests

```bash
npm test
```

### Code Style

```bash
npm run lint
```

### Type Checking

```bash
npm run typecheck
```

## Deployment

1. Build the Docker image:
   ```bash
   docker build -t context-chest .
   ```

2. Set up environment variables for production
3. Deploy to your preferred platform (Fly.io, Render, etc.)

## Monitoring

- Prometheus metrics available at `/metrics`
- Grafana dashboards at `http://localhost:3000`
- Default credentials: admin/admin

## License

MIT 