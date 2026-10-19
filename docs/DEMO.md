# Demo and submission guide

## Prepare

1. Run `npm ci`, `npm run build`, and `npm start`.
2. Use one browser profile as Meera and another as Leela. Open Leela's Care requests before beginning the drill.
3. Check that Leela permits drills and is available. Her private-note and reminder permissions should remain off.
4. Use only fictional requests. Reset the demo household between rehearsals if desired.
5. If showing live AI, configure the provider and verify it yourself first. Otherwise explain that the local helper is running; never describe it as a live model.

## Suggested 2:45 recording

| Time      | Show                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| 0:00–0:20 | Explain the coordination gap: sending an alert does not establish who will respond. |
| 0:20–0:45 | Interpret a morning reminder, review it, confirm, and check in.                     |
| 0:45–1:05 | Preview Leela's permission-filtered view.                                           |
| 1:05–1:40 | Start the labelled drill. Show the primary timeout and backup invitation.           |
| 1:40–2:05 | Leela accepts, records an outcome, and resolves. Show the older adult's timeline.   |
| 2:05–2:25 | Revoke a contact's request permission and show that the caregiver loses access.     |
| 2:25–2:45 | Explain the persistent backend, tests, and remaining external-integration limits.   |

## Accurate description

Saathi Care AI is an elder-care coordination prototype that helps an older adult create confirmed reminders, request support, and control what trusted people can see. A persistent workflow invites a primary contact, waits for an explicit response, and hands off to an approved backup when needed. Acceptance records an owner; a separate outcome closes the request. Contact-specific previews and labelled drills make the care process understandable and testable.

The implementation uses React, TypeScript, Express, SQLite, and a durable deadline worker. It has an optional OpenAI-compatible language adapter, a local interpreter, and optional browser speech. It is inspired by the Suraksha case study by Team StarBugs and implements its own focus on consent previews, drills, and explicit caregiver ownership.

Do not claim validated fall detection, clinical effectiveness, tested real-world emergency readiness, or delivery through an unconfigured provider. Wearable inputs remain unimplemented. Source code and a working local application do not constitute a submitted hackathon entry: the owner still needs to record the demo and complete the event submission.

## Event details

Consult the [official overview](https://next-byte-hacks-v5.devpost.com/) and [rules](https://next-byte-hacks-v5.devpost.com/rules). The supplied blueprint records discrepancies in eligibility and video lengths; a 2:45 demo fits both published ranges checked on 18 October 2026. Confirm eligibility with the organizer if the inconsistent conditions affect you. No organizer approval or Devpost submission has been made by this implementation.
