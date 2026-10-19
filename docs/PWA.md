# Installable Saathi Care PWA

Saathi is an online-first progressive web app. It can open in its own app window on supported devices, using the existing website and account permissions. A small offline page explains the connection problem without displaying saved care records.

## Try the production build

Use Node 24:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3001**. If `npm run dev` is already running, its API server also serves the latest `dist` build at port 3001; do not start another process on that port. The Vite development page on port 5173 intentionally does not register a service worker, so it is not the offline demonstration environment.

On a phone, use the deployed **HTTPS** address. An ordinary HTTP LAN address such as `http://192.168.x.x:3001` does not qualify as a secure context for service workers. The localhost development exception applies on the device running the browser.

## Install

- **Chrome / Edge on desktop or Android:** open Saathi in a normal browser window, sign in, then visit **Settings & accessibility → Install Saathi**. When the browser supplies its installation prompt, the card shows **Install app**. The browser may also provide installation through its address bar or menu. Browser engagement requirements and eligibility can delay the prompt.
- **iPhone / iPad:** open the site, use the browser's Share menu and choose **Add to Home Screen**; enable opening as a web app if the system asks. Exact menu availability depends on browser and OS version. The settings card provides this guidance instead of a button that cannot open a native prompt.
- **Installed window:** the settings card shows **App installed** when standalone mode is detected. Browser support varies; adding a bookmark is not always equivalent to installing a standalone app.

Installation is initiated by the user. Dismissing a prompt does not show a false success state. If prompting fails, the card explains how to use the browser menu. Private/incognito browser contexts normally do not permit OS installation.

## Offline behavior and privacy

The worker precaches exactly these public resources:

```text
/offline.html
/manifest.webmanifest
/favicon.svg
/icons/icon-192.png
/icons/icon-512.png
/icons/maskable-512.png
/icons/apple-touch-icon.png
```

Application navigations use the network first. When the request fails, the worker returns the offline page. It uses the saved display-language preference and contains English plus all 14 enabled regional translations, including right-to-left Urdu. It uses system fonts and needs no external translation or font service.

API requests and mutations are never put in Cache Storage and never replaced by the HTML fallback. The main app HTML, dashboard, user identity, notes, reminders, contact permissions, request details, and API responses are not service-worker-cached. There is no offline outbox or background replay of actions. Browser tabs that were already open can retain their existing in-memory view; the normal connection banner warns that it may be stale.

Help requests, check-ins and reminder changes require a connection to reach the server. Installing the PWA does not provide native alarms, push notifications, offline care actions, automatic emergency calls, or a guarantee of delivery. Server-side reminders and handoffs still require the backend worker to run. In-app updates are visible when a connected app window is open.

## Updates

The build hashes the offline content, translations, worker code, manifest and icons to create a new public-cache revision when needed. New workers wait for existing Saathi tabs/app windows to close before activation; forms are not forcibly reloaded. Activation removes older `saathi-public-*` caches only. The server sends `Cache-Control: no-cache` for the worker, manifest and offline page so browsers can revalidate them.

To obtain a pending update, close all Saathi tabs and installed windows, then reopen. Ordinary online frontend code is fetched through the existing HTTP behavior; no old application shell is retained in the worker.

## Hackathon demonstration

1. Use the production build or deployed HTTPS site in a normal Chrome/Edge window.
2. Show the install control or browser installation menu, then open the installed app.
3. Demonstrate the existing reminder, check-in, permissions, coverage and caregiver request flow.
4. Disconnect and reload: show the localized offline page and explain that care records and offline actions are not cached.
5. Reconnect and press **Try again** to reopen the live application.

Include the public URL, repository, screenshots, and demo video in the submission. PWA support is not a cloud deployment: the current persistent SQLite backend still needs a suitable host, or the separately discussed Vercel backend migration.

## Verification

Five browser tests cover manifest and icon dimensions, production Chrome installability diagnostics in a normal persistent profile, public-cache contents after authenticated requests, offline fallback in all 15 enabled languages, API network failure while offline, online recovery, a check-in that is not queued, simulated prompt dismissal/failure/installation, iPhone menu guidance, and standalone display-mode detection. Axe scans cover the offline page and settings install card.

The native installation dialog events and iPhone user agent are simulated for those interaction tests. Chrome's manifest/installation diagnostics are real; a physical Android/iPhone home-screen installation and native OS launch have not been performed. Verify those on your target device and final HTTPS deployment before recording the submission video.

Screenshots: [desktop install settings](screenshots/pwa-settings-desktop.png), [mobile install guidance](screenshots/pwa-install-mobile.png), [Hindi offline fallback](screenshots/pwa-offline-hindi.png), [Urdu mobile offline fallback](screenshots/pwa-offline-urdu-mobile.png).

## Source files

- `public/manifest.webmanifest`: install metadata and root application scope.
- `public/favicon.svg`, `public/icons/`: existing Saathi heart/check mark in the current navy palette; standard, maskable and Apple PNG icons.
- `scripts/generate-pwa-icons.mjs`: regenerates PNGs from the vector using Playwright/Chrome. Icons are committed; this script is not required during a production build.
- `src/pwa/`: offline template and public-only worker template.
- `vite.config.ts`: emits the localized offline page and revisioned worker during the normal build, including Docker builds.
- `src/PwaProvider.tsx`, `src/InstallApp.tsx`: install events, standalone detection, translated settings card and browser guidance.

Browser requirements: [web app manifest](https://web.dev/learn/pwa/web-app-manifest), [service-worker secure contexts and caching](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).
