# Deployment readiness

Run the complete release gate with Node 24:

```sh
npm ci
npm run check:release
```

This builds the application, runs backend tests, audits localization and formatting, boots an isolated production server, and runs Chrome browser tests against the built PWA. Install Playwright Chromium first on Linux (`npx playwright install --with-deps chromium`); Windows uses installed Chrome.

The production smoke test uses a temporary database and an automatically assigned port. It checks startup, health, HTML deep links, PWA resources and revalidation headers, protected APIs, disabled demo sign-in, registration, and secure HTTP-only session cookies. It does not touch the household database.

## Hosting configuration

Use one persistent Node 24 process or the supplied Docker image, with a writable persistent disk for SQLite. Serve the app through an HTTPS reverse proxy. Build with `npm ci && npm run build`; start with `npm start`.

Set these values in the hosting environment:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
DATABASE_PATH=/app/data/saathi.sqlite
DEMO_MODE=false
COOKIE_SECURE=true
```

Set the port and absolute database path to match the host. The image already supplies the host, port, database path and production mode defaults. The supplied Compose file deliberately overrides demo and cookie settings for localhost; do not use those overrides for a private public deployment. Keep provider credentials in server environment variables.

Use `/api/health` for readiness monitoring. Back up the persistent database using SQLite's online backup mechanism or stop the process before copying the database and its journal files. Test restoration before using real data. Keep only one application instance because reminder delivery and request routing run in-process.

## Final host checks

After deploying, verify HTTPS, registration and login, caregiver invitations, reminder confirmation, check-in, caregiver response and revocation with synthetic accounts. On the final URL, check manifest/worker responses and install the app on the intended Android/iPhone device. Disconnect, reload to the private offline fallback, reconnect and retry. Confirm a restart preserves records and monitor the health endpoint.

Local automated checks do not establish native phone installation, live provider delivery, Docker execution or public-host operation. See [verification evidence and limitations](VERIFICATION.md). No public deployment is created by the release gate.
