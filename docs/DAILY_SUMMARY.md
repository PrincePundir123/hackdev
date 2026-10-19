# Daily caregiver summary

Open **Daily summary** in the sidebar. The view refreshes every five seconds, and **Refresh summary** fetches the latest information immediately. It works in English and all 14 enabled regional languages. Each person continues to use their own display language.

The summary uses the older adult's household timezone and shows the current local date. It contains:

- **Check-in:** whether a self-reported check-in was recorded today and its server receipt time. No record is reported neutrally; the feature does not infer that a person missed a required check-in.
- **Reminders:** reminders reported complete today, currently due reminders including earlier overdue items, scheduled reminders due later today, and active reminders waiting for a check-in. Up to five due titles appear; counts include all matching records. These categories are not a percentage or a mutually exclusive total: a recurring reminder completed today can already be waiting for its next check-in.
- **Care requests:** currently unresolved real requests, requests assigned to the signed-in caregiver, and requests resolved today. Unanswered requests remain unresolved. Up to five open requests link to the permission-checked request detail and response dialog. Practice drills are excluded from these metrics.
- **Remaining schedule:** time intervals from now until local midnight. Older adults see household coverage gaps. Caregivers see their own remaining time outside available response coverage, without exposing another caregiver's weekly hours. This uses current participation, availability and sharing settings; it is not a guarantee of response.

## Explicit sharing

Check-in receipt times are **private by default**, including for previously created contacts. As the older adult, open **My care circle → Edit permissions → Check-in sharing**, then save. This is an ongoing permission until switched off. The summary exposes only the current day's check-in, not check-in history. The care-circle card and sharing preview show the permission.

Reminder access continues to require accepted participation and the existing reminder-sharing permission. Request access uses the existing request permissions. Restricted contacts receive generic request titles; unshared check-ins and reminders return no timestamps, titles or real counts. A caregiver cannot grant themselves check-in sharing. Pausing participation or revoking permissions removes access on subsequent reads.

The browser clears a failed summary fetch rather than displaying old private summary content. A permission version change also reloads the summary. Request details are fetched by ID with current server permissions, so summary links can open older unresolved requests outside the dashboard's recent-item list.

## Data and scope

`GET /api/summary/daily` is authenticated and bound to the signed-in account's care circle. It does not accept a target household or historical date. `server/summary.mjs` calculates the response from SQLite records and the existing coverage and consent services. The summary API returns only the request fields required by its list; notes and outcomes are fetched only when the request detail is opened and permission permits them.

This is a live view of **today**, not a saved end-of-day report. Completion counts use each reminder's latest self-reported completion timestamp; they are not a full recurrence history. There is no AI-generated interpretation, scheduled digest, external notification, email delivery or additional provider cost. The server must remain running for automatic reminder and request timers.

Screenshots: [caregiver summary](screenshots/daily-summary.png), [Urdu mobile summary](screenshots/daily-summary-urdu-mobile.png).
