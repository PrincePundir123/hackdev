<div align="center">

# Saathi Care AI

### Know what's needed. Know who's helping. Know what's next.

Care coordination for older adults and the people they trust.

**Daily check-ins · Accountable care requests · Consent-based sharing · Weekly coverage**

[Live demo](https://sahara-circle.onrender.com/) · [Watch demo video](https://www.youtube.com/watch?v=diU3GCz2oTM) · [Demo walkthrough](#try-the-demo) · [Screenshots](#screenshots) · [Run locally](#run-locally) · [Architecture](docs/ARCHITECTURE.md)

Prepared for [Next Byte Hacks V5](https://next-byte-hacks-v5.devpost.com/)

</div>

![Meera's personal dashboard with a daily check-in, reminders, trusted contacts, and current caregiver coverage](docs/screenshots/02-meera-dashboard.png)

## The problem

When an older adult asks for help, a message in a family chat can leave an important question unanswered: **who is actually taking care of it?** Someone may see the message and assume another person will respond. A reminder may be forgotten. A caregiver may be unavailable, with no clear backup.

Saathi brings those everyday tasks into a shared care workflow. The older adult can ask for support, see when someone accepts responsibility, and follow the request through to a recorded outcome. Family members can coordinate their availability while the older adult decides what each person can see.

## What Saathi does

| Capability                            | How it helps                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Personal dashboard**                | Brings check-ins, reminders, support requests, and trusted contacts into one place.                                             |
| **Accountable requests**              | Routes a confirmed request to an eligible contact, records acceptance, and tracks an explicit outcome.                          |
| **Backup handoffs**                   | Tries the next eligible contact after a decline or response timeout; unresolved requests stay visible.                          |
| **Weekly care coverage**              | Lets caregivers choose response hours and helps older adults identify gaps in the household plan.                               |
| **Flexible reminders**                | Supports fixed times and offsets after a manual check-in, with review, confirmation, snooze, and completion.                    |
| **Daily summary**                     | Shows today's self-reported check-in, reminder activity, open requests, and remaining schedule, subject to sharing permissions. |
| **Individual sharing choices**        | Gives each contact separate access to basic requests, private notes, reminder text, and check-ins.                              |
| **Regional interfaces**               | Provides English and 14 regional-language interfaces, including right-to-left Urdu.                                             |
| **Accessible, installable interface** | Includes responsive layouts, keyboard navigation, larger text, reduced-motion support, and PWA installation support.            |

### A request has an owner and an outcome

1. **Meera asks for help.** She enters a request, reviews the approved response order, and confirms.
2. **An eligible contact is invited.** Participation, permissions, availability, and weekly hours determine who can respond.
3. **Arjun accepts responsibility.** Acceptance identifies the person handling the request; it does not mark the task complete.
4. **The outcome is recorded.** The caregiver describes what happened and explicitly resolves the request.
5. **If support is still needed, the request remains open.** Declines, unanswered invitations, and overdue follow-up can lead to a backup handoff. When no eligible responder remains, Saathi shows that state.

## Why this matters

Saathi is designed to reduce the uncertainty between asking for help and knowing whether someone is handling it. Its focus is practical: make responsibility visible, help families plan availability, and preserve the older adult's control over personal information.

The intended users are older adults living independently and family members or trusted contacts coordinating everyday support. The next validation step is usability testing with those users, measuring whether they can understand request status, complete a handoff, identify a coverage gap, and manage sharing without assistance. Real-world care outcomes have not yet been evaluated.

## Try the demo

**Watch the project walkthrough: [Saathi Care AI — YouTube Demo](https://www.youtube.com/watch?v=diU3GCz2oTM)**

**Open the deployed app: [Saathi Care AI — Live Demo](https://sahara-circle.onrender.com/)**

Choose a fictional demo profile on the welcome screen to explore the care workflow. **No API key is required for the core demo.** Local setup instructions are available [below](#run-locally).

| Profile   | Role              | What to explore                                                                   |
| --------- | ----------------- | --------------------------------------------------------------------------------- |
| **Meera** | Older adult       | Check in, create reminders, request support, review coverage, and manage sharing. |
| **Arjun** | Primary caregiver | Accept requests, record outcomes, and set weekly response hours.                  |
| **Leela** | Backup contact    | Explore backup response and a more restricted view of personal information.       |

Use separate browser profiles or isolated browser contexts to keep multiple people signed in. Tabs in the same browser profile share a session.

### Suggested walkthrough

1. Continue as **Meera** and select **I am okay** to record a self-reported check-in.
2. Open **Request help**, enter “Please pick up my medicines from the pharmacy,” review the contacts, and confirm.
3. In a separate browser profile, continue as **Arjun**, open **Care requests**, accept responsibility, and record an outcome.
4. Set caregiver availability under **My weekly hours**, then inspect Meera's **Care coverage** page.
5. As Meera, choose **Ask your companion** and enter “Remind me to call my sister 10 minutes after my morning check-in.” Review and confirm the reminder.
6. Explore **Daily summary**, **My care circle**, sharing previews, and the language selector.

To demonstrate unanswered-request routing quickly, use **Practice a drill**. Drills are explicitly labelled, use accelerated response windows, and send no external notifications. Ordinary requests use a two-minute response window per contact.

## Screenshots

All 18 screenshots below were captured from the running local application using fictional demo accounts. They show actual interface states; optional live AI and external notifications were disabled.

### Everyday care

| Welcome and demo access                                                                            | Caregiver workspace                                                                                             |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ![Welcome screen with account access and fictional demo profiles](docs/screenshots/01-welcome.png) | ![Arjun's caregiver dashboard with care requests and availability](docs/screenshots/05-caregiver-dashboard.png) |

| Daily summary                                                                                                                 | Reminders                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| ![Daily summary showing today's check-in, reminders, requests, and remaining schedule](docs/screenshots/12-daily-summary.png) | ![Reminder list containing fixed-time and check-in-relative reminders](docs/screenshots/11-reminders.png) |

<details>
<summary><strong>View the care request journey: review, routing, acceptance, and resolution</strong></summary>

**Review before sending.** Meera sees the support request and approved contact order before confirming.

![Medicine pickup request with approved primary and backup contacts](docs/screenshots/03-request-review.png)

**Follow the request.** The care timeline records invitations and response state.

![Confirmed support request awaiting a caregiver response](docs/screenshots/04-request-timeline.png)

**Make responsibility visible.** The accepted request identifies its owner and provides an outcome field.

![Arjun has accepted responsibility and can record the outcome](docs/screenshots/06-accepted-request.png)

**Close the loop.** Resolution follows an explicit recorded outcome.

![Resolved medicine pickup request with a recorded caregiver outcome](docs/screenshots/07-resolved-request.png)

</details>

<details>
<summary><strong>View weekly scheduling and reminder confirmation</strong></summary>

**Caregiver response hours.** Caregivers can define their own weekly availability in the household timezone.

![Weekly response hours editor with a Monday availability window](docs/screenshots/08-weekly-hours.png)

**Household coverage.** The combined plan distinguishes coverage from gaps.

![Weekly household care coverage planner](docs/screenshots/09-coverage-planner.png)

**A proposal requires confirmation.** Everyday language becomes a reminder preview before it is saved.

![Review of a reminder scheduled ten minutes after a morning check-in](docs/screenshots/10-reminder-confirmation.png)

</details>

<details>
<summary><strong>View the care circle and privacy controls</strong></summary>

**Trusted contacts.** The care circle brings response order and sharing settings together.

![Meera's care circle with contact-specific sharing settings](docs/screenshots/13-care-circle.png)

**Separate permissions.** Sharing can be adjusted for each person and each supported information type.

![Arjun's sharing permissions for requests, private notes, reminders, and check-ins](docs/screenshots/14-sharing-permissions.png)

**Preview another person's access.** Meera can inspect what a restricted contact is allowed to see.

![Sharing preview showing Leela's restricted access](docs/screenshots/15-sharing-preview.png)

</details>

<details>
<summary><strong>View regional language, accessibility, and mobile screens</strong></summary>

**Hindi interface.** Each account can choose its own display language.

![Meera's dashboard displayed in Hindi](docs/screenshots/16-hindi-interface.png)

**Accessibility and connection settings.** The app exposes larger-text controls and the current integration mode.

![Settings page with accessibility preferences and prototype integration details](docs/screenshots/17-accessibility-settings.png)

**Mobile layout.** The same care workflow adapts to a narrow screen.

<img src="docs/screenshots/18-mobile-dashboard.png" alt="Meera's responsive dashboard on a 390-pixel-wide mobile viewport" width="340">

</details>

## How it is built

| Layer                  | Technology and responsibility                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Frontend               | **React, TypeScript, Vite** — role-specific screens, reviewed actions, responsive layouts, and local interface translations. |
| Backend                | **Express on Node.js 24** — authenticated APIs, household isolation, sharing checks, and care workflow transitions.          |
| Persistence            | **Node's built-in SQLite support** — accounts, reminders, requests, schedules, and care timelines.                           |
| Deadline processing    | **Server-side worker** — processes persisted reminder and request deadlines while the server runs.                           |
| Optional AI            | **OpenAI-compatible provider** — proposes structured interpretations; validated output requires user confirmation.           |
| Optional notifications | **Outbound webhook** — opt-in invitation notifications with generic content and bounded retries.                             |
| Verification           | **Node test runner, Playwright, axe-core** — backend behavior, browser journeys, and accessibility checks.                   |

The browser sends authenticated actions to Express. The server checks the current household and permissions before reading or changing SQLite records. Reminder and request deadlines are stored in the database so processing can resume after a server restart. Request acceptance uses transactions to prevent two responders from claiming the same request.

See [architecture, state transitions, and API endpoints](docs/ARCHITECTURE.md) for implementation details.

### What the AI does

AI is optional. Without provider credentials, a local interpreter supports a limited set of English reminder and sharing requests. With a configured compatible provider, the server can request a structured interpretation. Both paths return a proposal for the user to review; interpretation alone does not create a reminder or change a permission.

The separate **Request help** form handles support requests directly. Display-language support does not imply natural-language understanding in every supported language. Regional translations are drafts that need fluent-speaker review.

## Run locally

**Requirements:** Node.js **24.x**, npm, and a writable local directory for SQLite.

From the repository root:

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Vite serves the frontend and proxies API calls to Express on port **3001**. The default local setup enables the fictional demo profiles. Application data is stored in `data/saathi.sqlite`.

### Run the production build locally

```sh
npm run build
npm start
```

Open **http://localhost:3001**. Express serves both the built frontend and the API.

### Configuration

The core demo works without external services. To customize configuration, copy `.env.example` to `.env` using your editor or operating system's file-copy command.

| Setting                                                  | Purpose                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `PORT`, `HOST`                                           | Backend address; defaults are suitable for local development.         |
| `DATABASE_PATH`                                          | SQLite database location; use persistent local storage when deployed. |
| `DEMO_MODE`                                              | Enables fictional demo sign-in; disable for private production use.   |
| `COOKIE_SECURE`                                          | Keep `false` on local HTTP; set `true` behind production HTTPS.       |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`                  | Configure all three to enable the optional live interpreter.          |
| `NOTIFICATION_WEBHOOK_URL`, `NOTIFICATION_WEBHOOK_TOKEN` | Configure the optional external invitation channel.                   |

Provider credentials remain on the server. Keep `.env`, database files, and real personal information out of source control.

### Docker and hosting

```sh
docker compose up --build
```

The supplied Compose configuration is for a local demo. Production requires **one continuously running Node process**, persistent SQLite storage, and HTTPS. Keep a single application instance because deadline processing runs inside the server process. See [deployment instructions](docs/DEPLOYMENT.md) for production settings, backups, and host verification.

## Verification

Run the full release gate with Node 24:

```sh
npm run check:release
```

For browser checks, Windows uses installed Google Chrome. On Linux, install the Playwright browser and system dependencies first:

```sh
npx playwright install --with-deps chromium
```

| Command                   | What it checks                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run check`           | TypeScript, production build, and backend tests.                                                     |
| `npm run check:i18n`      | Translation keys and placeholders.                                                                   |
| `npm run format:check`    | Repository formatting.                                                                               |
| `npm run test:deployment` | Isolated production startup, protected APIs, session settings, and public resources.                 |
| `npm run test:e2e`        | Browser flows for reminders, requests, consent, coverage, summaries, localization, and PWA behavior. |

Browser tests use an isolated SQLite database under `.runtime`, separate from normal application data. Accessibility scans cover key screens and dialogs. These checks do not establish clinical effectiveness, translation accuracy, live provider delivery, or physical-device installation. See [verification scope and limitations](docs/VERIFICATION.md).

## Engineering challenges and lessons

- **A notification is only one step.** Invitation, acceptance, follow-up, and resolution need distinct states so unanswered work stays visible.
- **Privacy must hold across views.** Current sharing permissions are checked on the server for dashboards, request details, summaries, and previews.
- **Schedules need precise boundaries.** Coverage uses the household timezone and exact interval boundaries; accepted responsibility continues when a caregiver's scheduled hours end.
- **Timers need durable state.** Persisting due times allows the worker to resume processing after a restart.
- **Language coverage needs human validation.** Complete translation keys and bundled fonts support the interface, while fluent review remains necessary for consent and care terminology.

## Next steps

- Test the main workflows with older adults and caregivers, including larger text and mobile navigation.
- Review regional translations with fluent speakers.
- Validate opt-in notification delivery with a real provider and target devices.
- Add production-ready retention and account-deletion workflows.
- Evaluate the prototype on its final HTTPS host, including installation, recovery, and backup restoration.

## Scope and responsible use

Saathi is a care-coordination prototype. It does not provide medical advice, detect falls, dispatch emergency services, or guarantee that help will arrive. Check-ins and outcomes are self-reported. Coverage describes planned availability, not guaranteed response.

The server must remain running for automatic timers. There is no guaranteed operating-system reminder alarm when the browser is closed. The offline experience protects privacy with a fallback page; it does not provide offline access to care records or queue new actions. Continue using established care and emergency arrangements.

## Documentation

| Guide                                        | Contents                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| [Architecture and API](docs/ARCHITECTURE.md) | Trust boundaries, request state machine, scheduling, and endpoints.         |
| [Daily summary](docs/DAILY_SUMMARY.md)       | Current-day metrics, sharing behavior, and data scope.                      |
| [Regional languages](docs/LOCALIZATION.md)   | Supported interfaces, text handling, speech limits, and translation review. |
| [PWA behavior](docs/PWA.md)                  | Installation, offline fallback, and caching boundaries.                     |
| [Deployment](docs/DEPLOYMENT.md)             | Persistent hosting, production configuration, and backups.                  |
| [Verification](docs/VERIFICATION.md)         | Automated coverage, manual release checks, and known limits.                |

## Acknowledgments

Saathi was inspired by the Suraksha elder-care case study from **Team StarBugs**. This repository is an independent implementation focused on consent-based sharing, caregiver coverage, and accountable request handoffs.

The hackathon submission should link this repository alongside the final narrated demo, team information, and Devpost project description. [Next Byte Hacks V5](https://next-byte-hacks-v5.devpost.com/) requests a 1–3 minute working demo, public source with setup instructions, and at least 2–3 screenshots; the gallery above provides reusable project screenshots.
