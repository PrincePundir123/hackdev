# Verification record

Verified on **19 October 2026**, using Node **24.13.0**, Windows, and installed Google Chrome in headless mode. All test data is synthetic.

## Results

| Check                                | Result                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and Vite production build | Passed                                                                                                                                                      |
| Backend test suite                   | 42 tests passed, including daily summary permission isolation, timezone dates, ownership, record counts and account language persistence                    |
| Local request interpretation dataset | 30 supported/ambiguous/unsupported examples exercised within the backend suite                                                                              |
| Browser suite                        | 11 tests passed in 58.2 seconds, including daily summaries and all 14 enabled regional interfaces                                                           |
| Accessibility scan                   | No serious or critical WCAG A/AA-tagged axe findings on entry, personal dashboard, reminder dialog, coverage planner, weekly-hours editor and daily summary |
| Source formatting                    | Prettier check passed                                                                                                                                       |
| Localization source audit            | Passed; no untranslated literal JSX copy outside the brand name                                                                                             |

Accessibility automation is limited to the listed screens and does not establish complete WCAG conformance or usability for every older adult. No clinical or real-user trial was performed.

## Regional-language evidence

All 14 enabled regional dictionaries have the complete 689-key source catalog and preserve every dynamic placeholder. Browser checks loaded each welcome interface, persisted the guest choice, then exercised navigation, daily summary, coverage and settings for every enabled account language. Hindi reminder entry and confirmation preserved an English/Hindi personal title exactly in the database. Reload retained the preference. A separate caregiver used Urdu while the older adult remained in Hindi; the mobile Urdu planner and schedule editor were usable without horizontal document overflow, and the editor had no serious or critical findings in its axe scan.

The migration test opened a database with the previous users schema, confirmed an English default without changing account records, saved Hindi, and reopened it without adding a duplicate column. API checks rejected unsupported and unavailable language codes, unauthenticated changes, and attempts to target another user.

Screenshots: [Hindi confirmation](screenshots/language-hindi.png) and [Urdu mobile coverage](screenshots/language-urdu-mobile.png). Translation accuracy has not been established by fluent-speaker review. Eight scheduled languages remain unavailable; regional speech and comprehensive regional natural-language interpretation were not verified or claimed. See [availability and limitations](LOCALIZATION.md).

## Full-flow evidence

### Daily caregiver summary

An older adult recorded a check-in and explicitly enabled its sharing through the care-circle switch. The caregiver's summary changed from **Not shared** to today's received time. Completing a reminder through the older adult's UI increased the caregiver's completed-today count and removed its due title. A real request opened from the summary, was accepted and resolved through the detail dialog, and increased today's resolved count. Summary payloads excluded private notes even for a permitted detail viewer. Revoking check-in/reminder permissions removed their summary data, including after reload. A caregiver could not grant themselves check-in access; older clients omitting the new optional flag preserved its existing setting.

Backend tests covered local-midnight separation, DST date formatting, prior-day completions, more than 100 reminders without truncated counts, exclusion of practice drills, request ownership, personal versus household schedule scope, authentication and household isolation. The Urdu summary at 390px width had no document overflow. The English summary passed its axe A/AA scan with no serious or critical findings. The real localhost app was also checked using a temporary demo session; no care records or account preferences were changed.

Screenshots: [daily caregiver summary](screenshots/daily-summary.png), [Urdu mobile summary](screenshots/daily-summary-urdu-mobile.png). This is a current-day view; historical digests, email/SMS summary delivery and AI narrative generation are not included. See [daily summary details](DAILY_SUMMARY.md).

| Boundary                   | Evidence                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Interface → authentication | Demo profiles establish HTTP-only sessions; protected endpoints reject anonymous requests               |
| Request → interpretation   | Browser submits text, renders the proposal, and creates no reminder before confirmation                 |
| Confirmation → database    | Reminder creation persists; browser reload still shows the reminder                                     |
| Check-in → schedule        | Manual check-in calculates a due time; replay does not duplicate the event or daily reminder occurrence |
| Drill → escalation         | Primary contact times out; a separate backup account receives an invitation                             |
| Consent → output           | Backup response does not contain private request text or notes; preview uses the same filtering logic   |
| Acceptance → outcome       | Backup accepts, then records an outcome; the older-adult view updates to resolved                       |
| Revocation → access        | Revoked caregiver sees no requests and direct reads/actions are rejected                                |
| Small screen → navigation  | A 390px-wide mobile view opens navigation and requests without horizontal document overflow             |
| Restart → deadlines        | Closing and reopening the SQLite database preserves reminders and pending escalation state              |

## Additional backend cases

- Exact weekly gap and backup calculations, overlap merging, weekday boundaries, and household timezone handling (including repeated local times during a clock change).
- Only the linked caregiver can edit their own schedule; stale versions and invalid/overnight ranges are rejected.
- Off-schedule primary contacts are skipped; pending invitations hand off when scheduled hours end, while accepted responsibilities persist.
- Coverage respects current participation, availability, and sharing permissions. Caregivers see only their own schedule, while the older adult sees combined coverage.

## Coverage browser evidence

Two separate caregiver accounts saved Monday hours of 18:00–22:00 and 09:00–14:00. The older adult's planner correctly displayed the 14:00–18:00 gap and the names attached to covered periods. Saved hours survived browser reload. At 390px width the planner had no horizontal document overflow. A caregiver with an empty weekly plan was skipped when the older adult requested help, and an editor opened before another save was rejected rather than overwriting newer hours. The planner and schedule editor passed the automated accessibility checks above. New tables were also verified through the running localhost API without resetting existing data.

## Original backend coverage

- Wrong password, expired/removed session, missing mutation protection header, and disabled demo mode.
- Isolated households and role boundaries: a caregiver cannot create older-adult reminders or edit another contact's policy.
- Invitation email binding, single use, and minimal default permissions.
- Duplicate event and reminder keys, late acceptance, and repeat acceptance.
- Primary decline, no-responder status, overdue follow-up, and backup handoff.
- Revocation while pending and after ownership assignment, including pending outbox cancellation.
- Daily reminder re-arming, snoozing, and fixed-time delivery.
- Drill opt-in and exclusion from external messages.
- External provider failure with three bounded retry attempts; generic payload excludes private notes.
- Model-response schema validation, unknown contact rejection, timezone conversion, and provider-failure fallback.

## What was not verified against a real external service

- **Live AI:** the adapter was exercised with controlled provider responses and failure mocks. No paid provider key was supplied, so a real model call was not made. Local interpretation runs out of the box.
- **External notification delivery:** webhook success/failure logic is implemented; actual receipt by a real email/SMS/push provider was not tested or claimed.
- **Microphone and speech service:** browser recognition and speech-synthesis code is implemented; real microphone accuracy and speech-provider availability were not tested.
- **Docker:** a Dockerfile and local Compose configuration are included; Docker was unavailable in the execution environment.
- **Cloud hosting:** no production environment, public deployment, or domain was provisioned. A single-instance persistent host is required for this design.
- **CI execution on GitHub:** the workflow is configured; local command results are the evidence recorded here unless a separate CI run is inspected.

## Known scope limits

No wearable integration, automated fall detection, medical advice, emergency dispatch, multi-household caregiver account, password recovery, email verification, automatic data-retention job, or production security certification is included. A request lost before reaching the server is not queued offline. The UI exposes a connection error; the user must retry. In-app alerts require a connected browser, and the worker requires the server to stay running.

The repository implements the blueprint's practical hackathon core and optional provider adapters. Future clinical, hardware, and operational work is deliberately distinct from completed software functionality.
