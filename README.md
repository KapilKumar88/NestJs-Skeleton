# NestJS Skeleton

A production-ready NestJS REST API boilerplate with JWT authentication, Prisma ORM (PostgreSQL), BullMQ (Redis) queues, and nodemailer.

---

## Prerequisites

Make sure the following are installed and running on your machine before starting.

| Requirement | Version | Notes |
|-------------|---------|-------|
| [Node.js](https://nodejs.org/) | ≥ 18 | |
| [npm](https://npmjs.com/) | ≥ 9 | Comes with Node.js |
| [PostgreSQL](https://www.postgresql.org/) | ≥ 14 | Database |
| [Redis](https://redis.io/) | ≥ 6 | Queue storage & rate limiting |
| SMTP account | — | [Mailtrap](https://mailtrap.io/) is easiest for dev |

---

## Quick Start (Local / Dev)

```bash
# 1. Clone the repo
git clone <repo-url>
cd NestJs-Skeleton

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env — see the Environment Variables section below

# 4. Generate Prisma client & run migrations
npx prisma generate
npx prisma migrate dev --name init

# 5. Start in watch mode (hot reload)
npm run start:dev
```

App runs at: `http://localhost:3030`  
Swagger docs: `http://localhost:3030/api-docs`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values below.

### App

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3030` | HTTP port |
| `NODE_ENV` | No | `development` | `development` / `production` |
| `APP_URL` | Yes | — | Public base URL (used in email links) |

### Database

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |

```env
# Format:
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<dbname>?schema=public"

# Example (local):
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp?schema=public"
```

### JWT

Both secrets **must differ** and be **≥ 32 characters**. Generate them with:

```bash
openssl rand -hex 64
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | Access token signing secret |
| `JWT_EXPIRES_IN` | No | `15m` | Access token TTL (e.g. `15m`, `1h`) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing secret (must differ from above) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL (e.g. `7d`, `30d`) |

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | Yes | `localhost` | Redis hostname |
| `REDIS_PORT` | Yes | `6379` | Redis port |
| `REDIS_PASSWORD` | No | — | Redis password (if auth enabled) |

### Mail (SMTP)

| Variable | Required | Description |
|----------|----------|-------------|
| `MAIL_HOST` | Yes | SMTP host (e.g. `smtp.mailtrap.io`) |
| `MAIL_PORT` | Yes | SMTP port (e.g. `587`) |
| `MAIL_USER` | Yes | SMTP username |
| `MAIL_PASS` | Yes | SMTP password |
| `MAIL_FROM` | Yes | From address (e.g. `noreply@example.com`) |

### Security & CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | Yes | — | Comma-separated allowed origins. Empty = deny all |
| `BODY_LIMIT` | No | `1mb` | Max request body size |

```env
# Example:
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Rate Limiting & Account Lockout

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `THROTTLE_TTL` | No | `60` | Rate-limit window in seconds |
| `THROTTLE_LIMIT` | No | `100` | Max requests per window per IP |
| `MAX_LOGIN_ATTEMPTS` | No | `5` | Failed logins before account lockout |
| `LOCKOUT_MINUTES` | No | `15` | Lockout duration in minutes |

---

## Running the App

### Development (watch mode — hot reload)

```bash
npm run start:dev
```

### Local (single run, no watch)

```bash
npm run start
```

### Production

```bash
# 1. Build
npm run build

# 2. Start
npm run start:prod
```

> **Note:** Swagger (`/api-docs`) is automatically disabled when `NODE_ENV=production`.

---

## Database

```bash
# Generate Prisma client (run after any schema change)
npx prisma generate

# Create and apply a new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations in production (no prompt, no dev-only features)
npx prisma migrate deploy

# Open the Prisma database browser
npx prisma studio
```

---

## Testing

```bash
# Run all unit tests
npm test

# Run a specific test file
npx jest src/api/v1/auth/auth.service.spec.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# End-to-end tests
npm run test:e2e
```

---

## Code Quality

```bash
# Lint and auto-fix
npm run lint

# Format with Prettier
npm run format
```

---

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/v1/auth/register` | Public | Register (always 200, enumeration-safe) |
| `GET` | `/v1/auth/verify-email` | Public | Verify email with token |
| `POST` | `/v1/auth/login` | Public | Login → returns access + refresh tokens |
| `POST` | `/v1/auth/refresh` | Public | Rotate refresh token |
| `POST` | `/v1/auth/logout` | Bearer | Revoke session(s) |
| `POST` | `/v1/auth/forgot-password` | Public | Send reset email (always 200) |
| `POST` | `/v1/auth/reset-password` | Public | Set new password |
| `POST` | `/v1/auth/resend-verification` | Public | Resend verification email (always 200) |
| `GET` | `/v1/users/me` | Bearer | Get current user profile |
| `GET` | `/v1/todos` | Bearer | List todos (paginated) |
| `POST` | `/v1/todos` | Bearer | Create todo |
| `GET` | `/v1/todos/:id` | Bearer | Get todo by ID |
| `PATCH` | `/v1/todos/:id` | Bearer | Update todo |
| `DELETE` | `/v1/todos/:id` | Bearer | Delete todo |
| `GET` | `/v1/health` | Public | Health check (DB + Redis) |

Full interactive docs available at `/api-docs` when running locally.

---

## Project Structure

```
src/
├── api/v1/           # Feature modules (auth, users, todos)
├── common/           # Filters, interceptors, decorators, pipes, constants
├── config/           # Typed env config (never use process.env outside here)
├── guard/            # JWT strategy, auth guard, decorators
├── health/           # /v1/health endpoint
├── queues/           # BullMQ email queue processor
├── services/         # Shared services: Prisma, Redis, Mail
├── templates/emails/ # EJS email templates
├── types/            # Shared TypeScript interfaces
└── main.ts           # Bootstrap (Swagger, versioning, guards, pipes)
```

---

## Environment File Examples

<details>
<summary>📄 .env (local / development)</summary>

```env
PORT=3030
NODE_ENV=development
APP_URL=http://localhost:3030

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp?schema=public"

JWT_SECRET=your_dev_access_secret_min_32_chars_here_xxxx
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_dev_refresh_secret_min_32_chars_here_xxxx
JWT_REFRESH_EXPIRES_IN=7d

REDIS_HOST=localhost
REDIS_PORT=6379

MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=587
MAIL_USER=your_mailtrap_user
MAIL_PASS=your_mailtrap_pass
MAIL_FROM=noreply@example.com

CORS_ORIGINS=http://localhost:3000,http://localhost:5173
BODY_LIMIT=1mb

THROTTLE_TTL=60
THROTTLE_LIMIT=100
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=15
```

</details>

<details>
<summary>📄 .env (production)</summary>

```env
PORT=3030
NODE_ENV=production
APP_URL=https://api.yourdomain.com

DATABASE_URL="postgresql://<user>:<password>@<db-host>:5432/<dbname>?schema=public"

JWT_SECRET=<generated_with_openssl_rand_hex_64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<different_generated_with_openssl_rand_hex_64>
JWT_REFRESH_EXPIRES_IN=7d

REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>

MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USER=apikey
MAIL_PASS=<sendgrid_api_key>
MAIL_FROM=noreply@yourdomain.com

CORS_ORIGINS=https://yourdomain.com
BODY_LIMIT=1mb

THROTTLE_TTL=60
THROTTLE_LIMIT=100
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=15
```

</details>
