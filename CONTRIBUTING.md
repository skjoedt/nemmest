# Contributing to Nemmest

Thanks for your interest in contributing. This document explains how to get the development environment running and how to submit changes.

---

## Development Setup

### Prerequisites

- [mise](https://mise.jdx.dev/) — manages the Node.js toolchain and all dev tasks. Install with:
  ```sh
  curl https://mise.run | sh
  ```
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose — for the development database

### Steps

1. **Fork and clone**

   ```sh
   git clone https://github.com/skjoedt/nemmest.git
   cd nemmest
   ```

2. **Install toolchain and dependencies**

   ```sh
   mise install        # installs Node.js 25
   mise run install    # installs npm dependencies
   ```

3. **Configure environment**

   ```sh
   cp .env.example .env
   ```

   The defaults in `.env.example` match the dev database — no edits needed for local development.

4. **Start the database and run migrations**

   ```sh
   mise run db:start
   mise run db:migrate
   ```

5. **Start the development server**

   ```sh
   mise run dev
   ```

   The app will be available at [http://localhost:5173](http://localhost:5173).

6. **Log in**

   Go to the **Settings** page and enter your nemlig.com credentials. These are sent directly to nemlig.com server-side and never stored.

---

## Available Commands

| Command | Description |
|---|---|
| `mise run dev` | Start development server with hot reload |
| `mise run build` | Production build |
| `mise run preview` | Preview production build locally |
| `mise run check` | Run Svelte type checker |
| `mise run db:start` | Start the development database |
| `mise run db:stop` | Stop the development database |
| `mise run db:generate` | Generate a migration from schema changes |
| `mise run db:migrate` | Apply pending migrations |

---

## Code Guidelines

The key principles:

- **Keep it extremely simple** — prefer straightforward, minimal code and maintainable abstractions over clever but complex solutions
- **Minimize footprint** — Keep the code footprint as small as possible e.g. by using dependencies wisely
- **Keep nemlig.com API code contained** — all nemlig.com API interactions belong in `src/lib/nemlig.ts` and `src/lib/nemlig-context.ts`
- **Avoid API storms** — cache aggressively and batch requests where possible, and never send erroneous requests to the nemlig API (e.g. lazy try/catch)

---

## Database Migrations

Schema changes require a Drizzle migration:

1. Edit `src/lib/schema.ts`
2. Generate a migration:
   ```sh
   mise run db:generate
   ```
3. Review the generated SQL in `drizzle/`
4. Apply it:
   ```sh
   mise run db:migrate
   ```

Commit both the schema change and the generated migration file together.

---

## Submitting Changes

1. Create a branch from `main`:
   ```sh
   git checkout -b your-feature-name
   ```

2. Make your changes and ensure the type check passes:
   ```sh
   mise run check
   ```

3. Commit with a clear, concise message describing *why* the change is made.

4. Open a pull request against `main` with a description of what the PR does and why.

---

## Project Structure

```
src/
├── lib/
│   ├── components/        # Svelte UI components
│   ├── server/            # Server-only utilities
│   ├── workers/           # Background jobs
│   ├── nemlig.ts          # nemlig.com API client (keep API code here)
│   ├── nemlig-context.ts  # Search JWT caching
│   ├── schema.ts          # Drizzle database schema
│   ├── db.ts              # Database client
│   ├── logger.ts          # Logging utility
│   ├── rate-limit.ts      # Rate limiting
│   ├── format.ts          # Formatting helpers
│   └── types.ts           # Shared TypeScript types
└── routes/
    ├── api/               # API endpoints
    ├── recipes/           # Recipes page
    ├── products/          # Products page
    ├── basket/            # Basket page
    └── settings/          # Settings page
```

For details on the nemlig.com API, see [NEMLIG_API.md](NEMLIG_API.md).
