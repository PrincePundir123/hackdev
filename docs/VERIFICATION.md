# Verification

Run the complete release check with Node 24:

```sh
npm ci
npm run check:release
```

## Automated coverage

- TypeScript compilation and production Vite build
- Backend authentication, household isolation, consent, reminders, request routing, coverage schedules, localization, and daily-summary tests
- Production startup with an isolated SQLite database, disabled demo access, secure cookies, protected APIs, deep links, and PWA resources
- Browser flows for reminders, check-ins, caregiver handoffs, permission revocation, weekly coverage, mobile navigation, localization, and daily summaries
- PWA manifest and icon validation, public-only offline caching, offline recovery, install controls, and standalone detection
- Accessibility scans on the entry screen, dashboard, dialogs, coverage planner, schedule editor, daily summary, and offline page

The Playwright configuration starts a production server on port 4011 and creates test data under `.runtime`. It does not read or change the normal application database.

## Manual release checks

Before a public release, verify the final HTTPS deployment on the target phones and browsers. Confirm installation, offline fallback, reconnection, account creation, invitations, reminders, check-ins, caregiver response, permission revocation, persistence after a server restart, and database backup restoration.

## Limits

Automated tests use controlled responses for optional AI and webhook integrations. They do not verify a paid model provider, real notification delivery, microphone accuracy, physical-device installation, clinical outcomes, or emergency response. Regional translations also require fluent-speaker review before public use.
