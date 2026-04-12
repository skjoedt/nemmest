# nemmest

[![CI](https://github.com/skjoedt/nemmest/actions/workflows/ci.yml/badge.svg)](https://github.com/skjoedt/nemmest/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A single-user, self-hosted meal planning and grocery shopping assistant for [nemlig.com](https://nemlig.com).

Nemmest gives you a proper favorites system for products and recipes — without the noise of purchase history or search clutter — and tracks ingredient prices over time so you can shop at the right moment.

> **Note:** This is an early-stage project. It is unofficial and not affiliated with or endorsed by nemlig.com.

---

## Features

- **Recipe favorites** — save nemlig.com recipes, adjust ingredient quantities, deselect items you don't need, and add custom products from search
- **Product favorites** — bookmark individual products independently of your order history
- **Price history** — daily price tracking for all favorited recipe ingredients, visualized as a 90-day chart
- **nemlig.com proxy** — authenticates with your nemlig.com account server-side so your credentials never leave the server
- **Basket integration** — add products directly to your nemlig.com shopping basket

---

## Prerequisites

| Requirement | Version |
|---|---|
| [Docker](https://docs.docker.com/get-docker/) & Docker Compose | v2+ |
| A nemlig.com account | — |

For manual (non-Docker) setup you also need Node.js 25+ and a PostgreSQL 17+ database.

---

## Quick Start (Docker)

1. **Clone the repository**

   ```sh
   git clone https://github.com/skjoedt/nemmest.git
   cd nemmest
   ```

2. **Configure environment**

   ```sh
   cp .env.example .env
   ```

   Edit `.env` and set a strong `POSTGRES_PASSWORD` (see [Environment Variables](#environment-variables)).

3. **Start the stack**

   ```sh
   docker compose up -d
   ```

   This builds the app image, starts PostgreSQL, runs database migrations automatically, and starts the server on port 3000.

4. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000) and log in with your nemlig.com credentials on the **Settings** page.

---

## Manual Setup

If you prefer to run without Docker:

1. **Install dependencies**

   Ensure you have [Node.js 25+](https://nodejs.org/) installed, then:

   ```sh
   npm install
   ```

2. **Start a PostgreSQL database**

   ```sh
   docker compose -f docker-compose.dev.yml up -d
   ```

   Or point `DATABASE_URL` at an existing PostgreSQL 17+ instance.

3. **Configure environment**

   ```sh
   cp .env.example .env
   # Edit .env with your DATABASE_URL and optional settings
   ```

4. **Run database migrations**

   ```sh
   npx drizzle-kit migrate
   ```

5. **Start the development server**

   ```sh
   npm run dev
   ```

   Or build and run in production mode:

   ```sh
   npm run build
   node build/index.js
   ```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string, e.g. `postgres://user:pass@host:5432/nemmest` |
| `POSTGRES_PASSWORD` | Docker only | `nemmest` | Password for the PostgreSQL container. Set a strong value in production. |
| `PORT` | No | `3000` | Port the app listens on (Docker compose only) |
| `LOG_LEVEL` | No | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |

When running via Docker Compose, `DATABASE_URL` is automatically constructed from `POSTGRES_PASSWORD`. You only need to set it manually for a manual/external database setup.

---

## Architecture

Nemmest is a [SvelteKit](https://kit.svelte.dev/) 2 application using [Svelte 5](https://svelte.dev/) with runes, backed by [PostgreSQL](https://www.postgresql.org/) via [Drizzle ORM](https://orm.drizzle.team/).

```
src/
├── lib/
│   ├── components/     # Svelte UI components
│   ├── server/         # Server-only utilities
│   ├── workers/        # Background jobs (daily price fetch)
│   ├── nemlig.ts       # nemlig.com API client
│   ├── nemlig-context.ts  # Search JWT caching
│   ├── schema.ts       # Database schema (Drizzle)
│   └── ...
└── routes/
    ├── api/            # REST API endpoints
    ├── recipes/        # Recipe favorites page
    ├── products/       # Product search & favorites page
    ├── basket/         # Shopping basket view
    └── settings/       # Account login & settings
```

**Key design decisions:**

- **API proxy** — all nemlig.com requests are proxied server-side at `/api/nemlig/[...path]`, keeping session cookies out of the browser
- **Search gateway** — product and recipe search uses nemlig.com's anonymous search API with a cached JWT token
- **Price tracking** — a cron job runs daily at 06:00 to snapshot ingredient prices for all favorited recipes
- **Rate limiting** — in-memory token bucket limiting for login attempts (3/10 min) and burst requests (10/3 sec)

**Tech stack:**

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 / Svelte 5 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 17 |
| ORM | Drizzle ORM |
| Runtime | Node.js 25 |
| Charts | uPlot |

---

## Using a Pre-built Image

A Docker image is published to the GitHub Container Registry on every push to `main`:

```sh
docker pull ghcr.io/skjoedt/nemmest:latest
```

You can use it in your own `docker-compose.yml`:

```yaml
services:
  app:
    image: ghcr.io/skjoedt/nemmest:latest
    environment:
      DATABASE_URL: postgres://nemmest:yourpassword@db:5432/nemmest
    ports:
      - '3000:3000'
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: nemmest
      POSTGRES_USER: nemmest
      POSTGRES_PASSWORD: yourpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U nemmest -d nemmest']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## Roadmap

- [x] Settings page with nemlig.com login
- [x] nemlig.com API proxy
- [x] PostgreSQL database for favorites
- [x] Product search and favorites
- [x] Recipe search and favorites
- [x] Ingredient customization per recipe
- [x] Daily price history tracking
- [ ] Add recipes/products to nemlig.com basket
- [ ] Automated meal planner from favorites
- [ ] Delete individual recipe line items from basket

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up the development environment and submit changes.

---

## Disclaimer

Nemmest is an independent, unofficial project. It is not affiliated with, endorsed by, or connected to nemlig.com or its parent company in any way. Use it at your own risk and in accordance with nemlig.com's terms of service.

---

## License

[MIT](LICENSE)
