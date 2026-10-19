# Saathi care workspace redesign QA

Verified 19 October 2026 in installed Google Chrome, headless, against the running local app.

## Scope and visual evidence

The selected visual reference is the [Birdie Family App feature page](https://www.birdie.care/product-features/family-app). This is an adaptation of its visual language to Saathi's existing interactive application. Birdie's public marketing page and Saathi's authenticated care workspace represent different product states; their navigation, content and column proportions intentionally differ. This report does not claim a pixel-identical Birdie app clone.

- Source capture: `.runtime/design-reference/birdie-viewport.png`, 1440 × 1050 pixels.
- Implementation capture: `.runtime/design-reference/overview-desktop.png`, 1440 × 1050 pixels.
- Both use a 1440 × 1050 CSS viewport and device scale factor 1. No density normalization was needed.
- Combined visual comparison: [reference and implementation together](docs/screenshots/redesign-comparison.png), 2880 × 1090 pixels, with each capture at its original size beneath a label.
- Entry comparison: `.runtime/design-reference/entry-comparison.png`, same dimensions and density.
- Focused views inspected: [Hindi confirmation](docs/screenshots/language-hindi.png), [Urdu mobile coverage](docs/screenshots/language-urdu-mobile.png), [daily summary](docs/screenshots/daily-summary.png), [coverage editor and planner](docs/screenshots/coverage-planner.png), and [sharing preview](docs/screenshots/sharing-preview.png). These make the text, form controls, status colors and localized wrapping readable beyond the full-view comparison.
- All nine older-adult pages were captured at desktop 1440 × 1050 and mobile 390 × 844. Caregiver overview and daily summary were captured separately. No horizontal document overflow or browser page errors were recorded in this walkthrough. Local full captures and the audit JSON are under `.runtime/design-reference/` (ignored scratch evidence).

## Findings and iteration history

1. **P2, summary information density — fixed.** The first version stretched the short check-in panel to match the reminders panel, leaving a large empty card. The revised grid groups the compact check-in and requests beside reminders, with coverage beneath. The final summary capture confirms that all four areas remain readable and the unused card space is removed.
2. **P2, mobile navigation keyboard access — fixed.** The menu now includes an explicit close control, Escape dismissal, focus containment and focus restoration. The closed mobile navigation is inert, so offscreen controls cannot receive keyboard focus. Resizing to desktop exits the mobile menu state. The browser regression verifies inert state, focus wrapping and restoration.
3. **Test ambiguity — fixed.** The functional daily-summary shortcut introduced a second button with the navigation label. Existing tests now select the main navigation explicitly. Assertions about data, sharing and outcomes remain intact.

The post-fix visual review uses the final combined comparison and the regenerated browser screenshots linked above. No actionable P0, P1 or P2 visual issues remain in the reviewed states.

## Required fidelity surfaces

| Surface              | Review                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonts and typography | Birdie's computed heading font was Poppins with navy text. Saathi now bundles Poppins locally for English headings, retains its readable DM Sans body, and preserves the existing regional font fallbacks. Headings, secondary text and form labels were inspected in English, Hindi and Urdu.                                                                          |
| Spacing and layout   | Shared 18–26px rounded surfaces, consistent card padding, larger section gaps and pill actions follow the reference's spacious composition. Navigation adapts to the working app. Mobile cards stack; the weekly calendar uses three columns on small screens.                                                                                                          |
| Colors and tokens    | Deep navy `#00264d`, aqua `#abe0df`, yellow `#facf80` and pale aqua panels match the source direction. Success, warning and privacy states retain distinct, readable colors and text labels.                                                                                                                                                                            |
| Images and icons     | No Birdie logos, mascots or product screenshots are used as Saathi assets. Decorative garden artwork was removed. The overview displays actual household identity and a working summary shortcut. Existing Lucide interface icons remain consistent and distinguish navigation destinations. Initial-based avatars are account identifiers, not substitute photographs. |
| Copy and content     | Saathi's existing translated copy, account names, reminder titles, privacy explanations and care flows remain. No claims of Birdie affiliation were added. Personal writing is displayed as entered.                                                                                                                                                                    |

## Interaction and accessibility verification

The browser suite exercises reminder confirmation and persistence, check-in, primary/backup handoff, acceptance and resolution, sharing preview and revocation, weekly schedule editing and stale writes, all enabled regional interfaces, daily summaries and mobile navigation. Axe scans cover entry, dashboard, reminder dialog, coverage, schedule editor and summary; these automated checks are not a claim of complete WCAG conformance. Browser page-error listeners were checked during the complete page walkthrough.

The production build, 42 backend tests, localization source audit and formatting check pass. The React component review confirms hook cleanup for menu listeners, viewport changes and focus restoration, use of semantic buttons, existing translated accessible names, and preservation of server-driven care state.

## Implementation checklist

- [x] Shared theme and locally bundled heading font.
- [x] Entry, both account views and every existing care page styled consistently.
- [x] Summary, coverage, permissions, confirmation dialogs and request timelines included.
- [x] Mobile navigation, keyboard behavior and reduced-motion support.
- [x] Regional language and right-to-left layouts checked.
- [x] Final screenshots compared together with the selected visual source.

## Follow-up polish

Regional translations remain drafts requiring fluent-speaker review, as documented before this redesign. Real older-adult usability testing remains a useful next step. Neither item blocks the visual implementation requested here.

final result: passed
