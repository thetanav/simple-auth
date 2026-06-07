# auth-zero

A small TypeScript + Express authentication server using Prisma/PostgreSQL, JWT access/refresh tokens, and httpOnly cookies.

## What this project does

- Creates users with email/password.
- Signs users in and creates a session per login/device.
- Issues:
  - **Access token** (15 min) in JSON response.
  - **Refresh token** (7 days) in an **httpOnly cookie**.
- Stores only a **SHA-256 hash** of the refresh token in the database.
- Rotates refresh token on `/auth/refresh-token`.
- Invalidates session + token on `/auth/logout`.
- Serves a demo UI at `/demo` to visualize the full flow.

## Project structure

- `/index.ts` — app bootstrap, middleware, CORS headers, health route, static demo, auth router mount.
- `/src/auth/index.ts` — all auth endpoints and session/token logic.
- `/src/zod/zod.types.ts` — request validation schemas.
- `/src/lib/prisma.ts` — Prisma client initialization with Postgres adapter.
- `/prisma/schema.prisma` — `User`, `Session`, `Token` models.
- `/demo/*` — browser demo for signup/signin/refresh/logout + DB view.

## Request flow overview

### 1) Sign up (`POST /auth/signup-with-email`)

1. Validate email/password with Zod.
2. Check if user already exists.
3. Hash password with bcrypt.
4. In a DB transaction: create user + session.
5. Sign access + refresh JWTs.
6. Hash refresh token and store in `Token` table.
7. Set refresh token cookie and return access token.

### 2) Sign in (`POST /auth/signin-with-email`)

1. Validate input.
2. Find user and verify bcrypt password.
3. Create new session.
4. Create access + refresh tokens.
5. Store hashed refresh token.
6. Set cookie and return access token.

### 3) Refresh (`POST /auth/refresh-token`)

1. Read refresh token from cookie.
2. Hash it and find matching DB token row.
3. Ensure token/session are not expired.
4. Verify JWT and payload type (`refresh`).
5. Issue new access token.
6. Rotate refresh token (new JWT + updated DB hash + new cookie).

### 4) Session check (`GET /auth/session`)

- Uses refresh cookie + DB checks + JWT verification to return whether the user is logged in.

### 5) Logout (`POST /auth/logout`)

- Hashes cookie token, deletes token(s) + session, clears cookie.

## Database model

- **User**: account record (email/password hash).
- **Session**: device/login session with IP, user-agent, expiry.
- **Token**: hashed refresh token tied to a session.

This split allows revoking one device/session without affecting others.

## Environment variables

Required:

- `DATABASE_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`

Optional:

- `PORT` (default `3000`)
- `NODE_ENV` (`production` enables secure cookies)

## Run locally

```bash
npm install
npx prisma generate
npm run dev
```

Then open:

- API: `http://localhost:3000`
- Demo UI: `http://localhost:3000/demo`
- Health: `http://localhost:3000/health`

## Notes

- Current `npm test` script is a placeholder and exits with error by default.
- CORS is set dynamically from request origin and allows credentials.
