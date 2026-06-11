# simple-auth

Small TypeScript + Express authentication server using Prisma (Postgres), JWT access/refresh tokens, and httpOnly cookies.

Purpose

- Minimal, production-oriented example of email/password authentication with per-device sessions and refresh token rotation.

Key features

- Email/password signup and signin
- Per-login/device sessions
- Short-lived access tokens (15m) returned in JSON
- Long-lived refresh tokens (7d) stored in an httpOnly cookie
- Only SHA-256 hashes of refresh tokens are stored in DB
- Refresh token rotation on /auth/refresh-token
- Session invalidation on /auth/logout
- Demo UI at /demo to visualize flows and DB state

Quick start

1. Install and generate Prisma client:

```bash
npm install
npx prisma generate
```

2. Set environment variables (required):

- DATABASE_URL — Postgres connection string
- ACCESS_TOKEN_SECRET — secret for access JWTs
- REFRESH_TOKEN_SECRET — secret for refresh JWTs

Optional:

- PORT (default: 3000)
- NODE_ENV (set to production to enable secure cookies)

3. Run in development:

```bash
npm run dev
```

Open:

- API: http://localhost:3000
- Demo UI: http://localhost:3000/demo
- Health: http://localhost:3000/health

API endpoints (summary)

- POST /auth/signup-with-email — create account, returns access token + sets refresh cookie
- POST /auth/signin-with-email — authenticate, returns access token + sets refresh cookie
- POST /auth/refresh-token — rotate refresh token, returns new access token
- GET /auth/session — check session using refresh cookie
- POST /auth/logout — invalidate session(s) and clear cookie
- GET /demo — simple browser demo for the full flow

Project layout (important files)

- /index.ts — app bootstrap, middleware, CORS, static demo, auth router
- /src/auth/index.ts — auth endpoints, session/token logic
- /src/zod/zod.types.ts — request validation schemas
- /src/lib/prisma.ts — Prisma client initialization
- /prisma/schema.prisma — User, Session, Token models
- /demo — demo UI and DB viewer

Security notes

- Refresh tokens are stored only as SHA-256 hashes in DB; raw tokens are kept in httpOnly cookies
- Refresh tokens are rotated on use to prevent replay
- Use strong random secrets for ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET
- In production set NODE_ENV=production to enable secure cookie flags

Notes

- The `npm test` script is a placeholder and may exit with a non-zero status.

License

- MIT
