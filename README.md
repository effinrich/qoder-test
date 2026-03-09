# OAuth Service

A full-stack OAuth authentication service with support for Google and GitHub providers. Built with Fastify, React, TypeScript, and PostgreSQL.

## Features

- **OAuth Authentication**: Sign in with Google or GitHub
- **Session Management**: JWT access tokens with refresh token rotation
- **Account Linking**: Auto-link OAuth providers to existing accounts by email
- **Admin Dashboard**: Manage users, OAuth apps, and view audit logs
- **Security**: Token encryption at rest, replay detection, signed cookies

## Tech Stack

### Backend
- Fastify 4.x with TypeScript
- PostgreSQL with postgres.js
- @fastify/jwt for authentication
- @fastify/cookie for session cookies

### Frontend
- React 18 with TypeScript
- React Router 6
- Vite for build tooling

### Infrastructure
- Docker Compose for PostgreSQL
- pnpm workspaces for monorepo management

## Project Structure

```
.
├── apps/
│   ├── api/              # Fastify backend
│   └── web/              # React frontend
├── packages/
│   └── shared-types/     # Shared TypeScript types
├── infra/
│   └── docker-compose.yml
└── package.json          # Root workspace config
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm
- Docker (for PostgreSQL)

### Installation

1. Clone the repository and install dependencies:
```bash
pnpm install
```

2. Start PostgreSQL:
```bash
docker compose -f infra/docker-compose.yml up -d
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your OAuth credentials:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

5. Run database migrations:
```bash
pnpm db:migrate
```

6. Seed the database (creates admin OAuth apps):
```bash
pnpm db:seed
```

### Development

Start both API and web servers:
```bash
pnpm dev
```

Or start individually:
```bash
pnpm dev:api   # API only
pnpm dev:web   # Web only
```

The services will be available at:
- API: http://localhost:3000
- Web: http://localhost:5173

### OAuth App Configuration

Configure OAuth apps in the database or admin dashboard:

**Google:**
- Authorized redirect URI: `http://localhost:3000/auth/google/callback`

**GitHub:**
- Authorization callback URL: `http://localhost:3000/auth/github/callback`

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run tests |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed the database |

## API Endpoints

### Authentication
- `GET /auth/:provider` - Initiate OAuth flow
- `GET /auth/:provider/callback` - OAuth callback
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout
- `GET /auth/session` - Get current session

### User
- `GET /user/me` - Get current user
- `PATCH /user/me` - Update user profile
- `GET /user/connections` - Get OAuth connections
- `DELETE /user/connections/:provider` - Disconnect provider

### Admin
- `GET /admin/users` - List users
- `GET /admin/users/:id` - Get user details
- `DELETE /admin/users/:id` - Delete user
- `GET /admin/oauth-apps` - List OAuth apps
- `POST /admin/oauth-apps` - Create OAuth app
- `PATCH /admin/oauth-apps/:id` - Update OAuth app
- `DELETE /admin/oauth-apps/:id` - Delete OAuth app
- `GET /admin/audit-logs` - View audit logs
- `GET /admin/stats` - Get system statistics

## Security Features

- **PKCE**: OAuth 2.0 PKCE flow for secure authorization
- **Token Rotation**: Refresh tokens are rotated on each use
- **Replay Detection**: Revoked token reuse triggers family-wide revocation
- **Encryption**: OAuth tokens encrypted at rest
- **Signed Cookies**: State parameters stored in signed cookies
- **Rate Limiting**: Built-in rate limiting on auth endpoints

## License

MIT
