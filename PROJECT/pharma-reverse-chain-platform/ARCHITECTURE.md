# Pharma Reverse Chain — Option B Architecture (your stack)

```
React Frontend (Vite)          FastAPI Backend (Python)          PostgreSQL
       │                                   │                          │
       │  JWT login / role session         │                          │
       ├──────────────────────────────────►│                          │
       │  REST: batches, audit, verify     │  SHA-256 hash chain      │
       │  multipart: certificates/photos   │  Ed25519 signatures      ├─ application tables
       │  browser camera QR/barcode scan   │  state machine           └─ cryptographic audit ledger
       │                                   │  local file storage           (append-only)
```

There is **no blockchain**. The audit ledger is a normal PostgreSQL table
(`audit_events`) where each row cryptographically links to the previous row
and is signed with Ed25519.

## Tech stack (your table)

| Layer | Technology | Purpose | Where |
|---|---|---|---|
| Frontend | React + Vite | Web application | `frontend/` |
| UI | Tailwind CSS | Dashboards and responsive UI | `frontend/src/` |
| Backend | FastAPI + Python | APIs, workflows, validation | `backend/app/` |
| Database | PostgreSQL | Application data + cryptographic audit ledger | `postgres` service / `backend/init.sql` |
| Integrity | SHA-256 | Hash-chain generation + certificate hashing | `backend/app/crypto/hashchain.py` |
| Digital Signatures | Ed25519 | Authenticate every audit event | `backend/app/crypto/signatures.py` (PyNaCl) |
| Authentication | JWT | Role-based login/session | `backend/app/core/security.py`, `frontend/src/auth/` |
| File Storage | Local filesystem / object storage | Photos + destruction certificates | `backend/app/routers/files.py` → `storage/` |
| QR/Barcode | Browser camera scanner | Batch identification | `frontend/src/components/QrScanner.tsx` |
| API | REST | POS → batch verification | `POST /verify-batch` |
| Deployment | Docker + Docker Compose | Run the complete system | `docker-compose.yml` |

## Folder structure

```
pharma-reverse-chain/
├── docker-compose.yml              # postgres + backend + frontend (one command)
├── ARCHITECTURE.md                 # this file
├── backend/                        # FastAPI + Python
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   ├── init.sql                    # exact PostgreSQL DDL + indexes
│   ├── README.md
│   └── app/
│       ├── main.py                 # app, CORS, /health /stats /seed
│       ├── core/                   # config, JWT security, role deps
│       ├── crypto/                 # canonical JSON, SHA-256 chain, Ed25519
│       ├── db/                     # SQLAlchemy engine + models
│       ├── schemas/                # Pydantic models
│       ├── services/               # lifecycle, audit append/verify, seed
│       ├── routers/                # auth, batches, audit, verify, alerts, files
│       └── seed_data.py            # 10 batches, 6 actors, 5 users
├── frontend/                       # React + Vite + Tailwind
│   ├── Dockerfile / nginx serve
│   ├── package.json / vite.config.ts / tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx / App.tsx      # entry + role-guarded routes
│       ├── api/client.ts           # axios + JWT interceptors
│       ├── auth/AuthContext.tsx    # JWT session
│       ├── components/             # Layout, StatusBadge, VerifyWidget, QrScanner
│       └── pages/                  # Login, Overview, Pharmacy, Distributor,
│                                   # Manufacturer, Regulator, AuditLedger, BatchTimeline
└── src/                            # Live Next.js preview (mirrors the above 1:1)
    ├── app/                        # dashboards + identical REST paths
    ├── lib/audit.ts                # SHA-256 chain + Ed25519 (Node crypto)
    ├── lib/keystore.ts             # demo key store (never in DB)
    └── db/schema.ts                # Drizzle models incl. audit_events
```

## How the pieces map

| Concern | FastAPI (`backend/`) | Live preview (`src/`) |
|---|---|---|
| Hash chain | `app/crypto/hashchain.py` | `src/lib/audit.ts` → `computeEventHash` |
| Signatures | `app/crypto/signatures.py` | `src/lib/keystore.ts` |
| Append event | `services/audit_service.append_audit_event` | `appendAuditEvent` |
| Verify integrity | `GET /batches/{id}/verify-integrity` | same path in Next.js |
| POS verify | `POST /verify-batch` → `SALE_BLOCKED` + alert | same |
| Login | `POST /auth/login` → JWT | demo actor switcher (preview has no passwords) |
| Certificates | `POST /batch/{id}/certificate-file` | `POST /batch/{id}/certificate` |
| Seed | `POST /seed` | `POST /api/seed` |

## Run it

```bash
# Full system (your stack)
docker compose up --build
# frontend http://localhost:5173 · backend http://localhost:8000/docs · postgres :5432

# Backend only (local)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# Frontend only (local)
cd frontend && npm install && npm run dev
```

Demo logins (backend seed): `pharmacy1/pharmacy123`, `distributor1/distributor123`,
`manufacturer1/manufacturer123`, `regulator1/regulator123`.

## End-to-end demo (unchanged)

Pharmacy scan → log return → signed event → distributor receipt → manufacturer
certificate SHA-256 → signed destruction → DESTROYED 🔒 → second pharmacy tries
to sell → `/verify-batch` → SALE BLOCKED → signed `SALE_BLOCKED` event → regulator
alert → integrity verification VALID ✓ → tamper one row → `HASH_CHAIN_TAMPER_DETECTED` ❌.
