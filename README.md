# FinanceFlow – Track. Understand. Save.
Frontend-only expense tracker (HTML, CSS, vanilla JS, Chart.js bundled in `vendor/`). No backend, no login.

## Folder structure
```
FinanceFlow/
├── index.html
├── styles.css
├── script.js
├── manifest.json
├── service-worker.js
├── vendor/chart.umd.js
├── assets/icons/icon.svg
└── README.md
```

## Run in VS Code
1. Unzip, then **File > Open Folder** and choose `FinanceFlow`.
2. Install the **Live Server** extension (Ritwick Dey).
3. Right-click `index.html` > **Open with Live Server** (opens http://127.0.0.1:5500).
   Double-clicking index.html also works, but the PWA/offline part needs http://localhost or https.

## How storage works
Everything is saved in the browser's **localStorage** under the key `financeflow-data-v1`
(transactions, budgets, recurring items, theme). View it in DevTools > Application > Local Storage.
Data stays on your device; clearing site data or using another browser starts fresh. Use Settings > Export JSON for backups.

## Test checklist
Add / edit / delete a transaction, then search, filter and sort. Set a Food budget below current spending to see warnings.
Add a recurring item with a past date (it creates transactions on save). Export CSV/JSON, import the JSON back.
Toggle dark mode, refresh (data and theme persist), resize the window to phone width.

## Install as PWA / offline
Open via Live Server, then use the install icon in Chrome/Edge's address bar (or Share > Add to Home Screen on mobile).
After the first load the service worker caches all files, so the app works offline.
If you change files, bump `CACHE` in `service-worker.js` (e.g. `financeflow-v2`).
