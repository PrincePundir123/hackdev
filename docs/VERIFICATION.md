# Verification record

Verified on **18 October 2026**, using Node **24.13.0**, Windows, and installed Google Chrome in headless mode. All test data is synthetic.

## Results

| Check                                | Result                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| TypeScript and Vite production build | Passed                                                                                                 |
| Backend test suite                   | 21 tests passed                                                                                        |
| Local request interpretation dataset | 30 supported/ambiguous/unsupported examples exercised within the backend suite                         |
| Browser suite                        | 4 tests passed; final run completed in 29 seconds                                                      |
| Accessibility scan                   | No serious or critical WCAG A/AA-tagged axe findings on entry, personal dashboard, and reminder dialog |
| Source formatting                    | Prettier check passed                                                                                  |

Accessibility automation is limited to the listed screens and does not establish complete WCAG conformance or usability for every older adult. No clinical or real-user trial was performed.

## Full-flow evidence

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
