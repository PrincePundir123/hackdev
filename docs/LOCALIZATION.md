# Regional display languages

Use the **Language** selector on the welcome screen or in the signed-in header. A new account inherits the language selected during registration. An existing account loads its own saved language on sign-in; the older adult and each caregiver can choose independently. English remains available.

The prototype has draft interfaces for **Assamese, Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Nepali, Odia, Punjabi, Sanskrit, Tamil, Telugu, and Urdu**, alongside English. Buttons, navigation, form labels, confirmations, care states, generated timelines, sharing history, and the care coverage planner use the selected display language. Urdu uses a right-to-left layout. Fonts ship with the app.

**Bodo, Dogri, Kashmiri, Konkani, Maithili, Manipuri, Santali, and Sindhi remain unavailable.** They are listed as “Not yet” and cannot be selected or saved through the API. Reliable translations for these languages were not produced; another language has not been substituted. Consequently this release does **not** provide full coverage of all 22 scheduled Indian languages.

All regional copy is a draft and needs fluent-speaker review before public use, particularly consent, safety limitations, plural agreement, and care workflow terminology. Automated coverage checks establish that message keys and placeholders exist; they cannot establish translation accuracy.

## What stays as entered

Names, relationships, emails, reminder titles, private notes, and recorded outcomes retain their original text. An older adult can enter a Hindi reminder title while a caregiver uses English. The title remains Hindi; the caregiver's surrounding controls and generated status messages appear in English. Display-language switching does not translate somebody else's personal writing.

Generic request titles and generic outcomes supplied by the server carry explicit system-text markers, so they can be translated without changing personal titles or outcomes. Existing English timeline and audit records are displayed through known message templates; account and contact names inside them are preserved. Known errors are translated; unknown browser/provider/schema diagnostics use a generic translated retry message, so detailed field-specific guidance is limited for those errors.

Language selection loads a local translation file and, when signed in, saves only a language code to the account. No translation API is called and no personal note is sent to a translation service. This does not change the separately documented optional AI and notification-provider behavior.

## Text, speech, and device controls

Regional-language reminders start in **Enter details**, where the person supplies a title, time or check-in offset, and recurrence, then reviews and confirms the result. The included natural-language interpreter understands a limited set of **English** requests. Regional natural-language understanding is not claimed. The optional configured AI path is separate and has not been verified for all languages.

Browser microphone recognition and read-back remain English-only in this prototype. Regional text entry and confirmation work without a speech provider. Native date/time pickers, keyboard, and browser validation bubbles follow the device/browser language. Dates around those controls use the selected locale when supported; unsupported date locales use numeric dates and translated weekday names. Technical identifiers and timezone names stay unchanged.

## Maintaining translations

- `shared/languages.json` defines discovery names, text direction, and actual availability. Both the API and UI use it.
- `src/locales/en.json` is the source message dictionary. Each enabled language has a source-keyed JSON dictionary beside it. Key order has no runtime meaning.
- `src/i18n.ts` loads the selected dictionary on demand, interpolates values, formats dates, and translates known generated messages. React subscribes to language changes.
- `src/languages.css` contains bundled script fonts and right-to-left layout rules.
- Keep placeholders such as `{{p0}}` intact. Preserve boundary spaces in sentence fragments. Add new keys to English and every enabled dictionary together.
- Use `t()` for application copy. Only pass known generated fields to `systemText()`; personal writing must bypass translation.
- Run `npm run check:i18n`, `npm test`, `npm run build`, and `npm run test:e2e`. New languages also need script/font checks and fluent review; a passing automated test is not linguistic approval.

Screenshots: [Hindi reminder confirmation](screenshots/language-hindi.png), [Urdu mobile coverage planner](screenshots/language-urdu-mobile.png).
