# Pharma Reverse Chain — Frontend (React + Vite + Tailwind)

Web application for Pharmacy, Distributor, Manufacturer, and Regulator dashboards.

## Quick start

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev            # http://localhost:5173
```

Or via Docker Compose from the repo root: `docker compose up --build`.

## Layout

```
frontend/
├── index.html
├── vite.config.ts
├── tailwind.config.js / postcss.config.js
├── src/
│   ├── main.tsx / App.tsx / index.css     # entry, routes + guards, styles
│   ├── api/client.ts                      # axios + JWT interceptors + typed helpers
│   ├── auth/AuthContext.tsx               # JWT login/session, role redirects
│   ├── components/
│   │   ├── Layout.tsx                     # sidebar nav, session card
│   │   ├── StatusBadge.tsx                # status / event / integrity pills
│   │   ├── VerifyWidget.tsx               # POS verify-before-sale
│   │   └── QrScanner.tsx                  # browser camera QR/barcode scanner
│   └── pages/
│       ├── Login.tsx                      # JWT login + demo accounts
│       ├── Overview.tsx                   # KPIs + demo flow
│       ├── Pharmacy.tsx                   # stock, log returns, POS
│       ├── Distributor.tsx                # pickup, receive + quantity check, disputes
│       ├── Manufacturer.tsx               # destruction pipeline + certificate upload
│       ├── Regulator.tsx                  # batches, alerts, integrity table
│       ├── AuditLedger.tsx                # signed events + cryptographic proof
│       └── BatchTimeline.tsx              # per-batch timeline + integrity
```

## Notes

- JWT is stored in `localStorage`; axios attaches `Authorization: Bearer` and redirects to `/login` on 401.
- Routes are role-guarded (Regulator can view everything).
- QR/Barcode uses the browser `BarcodeDetector` API (Chrome/Edge, HTTPS) with manual-entry fallback.
- REST base URL comes from `VITE_API_URL`.
