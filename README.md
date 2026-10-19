# Saathi Care AI

Saathi is an installable care-coordination app for older adults and their trusted contacts. It combines reminders, daily check-ins, consent-based sharing, weekly caregiver coverage, and explicit request handoffs in one place.

## Getting started

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. The API runs on port 3001. Use the fictional Meera, Arjun, and Leela profiles to explore the app, or create a new care circle. Separate browser profiles are useful when testing multiple roles because tabs share the same session cookie.

To run the production build locally:

```sh
npm run build
npm start
```

Open `http://localhost:3001`. Application data is stored in `data/saathi.sqlite`.

## Features

- Password authentication, HTTP-only sessions, isolated households, and email-bound invitation codes
- Fixed-time and check-in-relative reminders with completion, snooze, recurrence, and deduplication
- Care requests with primary/backup routing, acceptance, outcome tracking, and overdue handoff
- Contact-specific permissions for requests, reminders, notes, and check-ins
- Weekly caregiver availability and household coverage planning
- English and 14 regional-language interfaces, including right-to-left Urdu
- Optional OpenAI-compatible request interpretation and outbound notification webhooks
- Installable PWA metadata and a privacy-preserving offline fallback
- Responsive layouts, keyboard navigation, reduced motion, and larger-text support

The app uses React, TypeScript, Vite, Express, and Node's built-in SQLite support. A server-side worker processes reminders and care-request deadlines, so production requires one continuously running Node process and persistent local storage.

## Configuration

Copy `.env.example` to `.env`. The app works without external services; the local request interpreter and in-app notifications are used by default.

Optional live interpretation requires:

```dotenv
AI_API_KEY=your-provider-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=your-model
```

Optional external notifications use `NOTIFICATION_WEBHOOK_URL` and `NOTIFICATION_WEBHOOK_TOKEN`. Provider credentials stay on the server.

## Testing

Run the full release gate:

```sh
npm run check:release
```

This runs the production build, backend tests, localization audit, formatting check, production startup test, and Playwright browser suite. Browser tests use an isolated database under `.runtime`.

Useful individual commands:

```sh
npm run check
npm run check:i18n
npm run test:deployment
npm run test:e2e
```

## Docker and deployment

For a local Docker demo:

```sh
docker compose up --build
```

For internet deployment, use HTTPS, set `COOKIE_SECURE=true` and `DEMO_MODE=false`, and mount persistent storage for the SQLite database. Keep a single application instance because deadline processing runs inside the server process. See [deployment instructions](docs/DEPLOYMENT.md).

## Documentation

- [Architecture and API](docs/ARCHITECTURE.md)
- [PWA installation and offline behavior](docs/PWA.md)
- [Localization](docs/LOCALIZATION.md)
- [Daily summary](docs/DAILY_SUMMARY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Test coverage and limitations](docs/VERIFICATION.md)

## Scope

Saathi coordinates communication; it does not provide medical advice, detect falls, contact emergency services, or guarantee that help will arrive. Continue using established care and emergency arrangements.

The project was inspired by the Suraksha elder-care case study from Team StarBugs and is an independent implementation.
