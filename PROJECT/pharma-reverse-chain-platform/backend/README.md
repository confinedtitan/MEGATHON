# Pharma Reverse Chain — Backend (FastAPI + Python)

Option B: **no blockchain**. PostgreSQL + SHA-256 hash chain + Ed25519 signatures + JWT auth.

## Quick start (Docker)

```bash
docker compose up --build
# backend → http://localhost:8000  (docs: http://localhost:8000/docs)
# frontend → http://localhost:5173
```

## Quick start (local)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, HASHCHAIN_SECRET
psql $DATABASE_URL -f init.sql
uvicorn app.main:app --reload --port 8000
```

Seed demo data:

```bash
curl -X POST http://localhost:8000/seed
# demo logins: pharmacy1/pharmacy123, distributor1/distributor123,
# manufacturer1/manufacturer123, regulator1/regulator123
```

## Layout

```
backend/
├── app/
│   ├── main.py                 # FastAPI app, CORS, router wiring, /health /stats /seed
│   ├── core/
│   │   ├── config.py           # env settings
│   │   ├── security.py         # JWT create/verify + bcrypt passwords
│   │   └── deps.py             # get_db, get_current_user, require_roles
│   ├── crypto/
│   │   ├── canonical.py        # canonical JSON (sort_keys, compact)
│   │   ├── hashchain.py        # SHA-256 event_hash + file hashing, GENESIS
│   │   └── signatures.py       # Ed25519 keypairs, Sign, Verify (PyNaCl)
│   ├── db/
│   │   ├── database.py         # SQLAlchemy engine/session
│   │   └── models.py           # MedicineBatch, AuditEvent, FraudAlert, Actor, User
│   ├── schemas/                # Pydantic request/response models
│   ├── services/
│   │   ├── lifecycle.py        # state machine (DESTROYED terminal)
│   │   ├── audit_service.py    # append + annotate + verify integrity
│   │   └── seed_service.py     # idempotent demo seed
│   ├── routers/
│   │   ├── auth.py             # POST /auth/login, GET /auth/me (JWT)
│   │   ├── batches.py          # CRUD + all lifecycle transitions
│   │   ├── audit.py            # GET /ledger, GET /batches/{id}/verify-integrity
│   │   ├── verify.py           # POST /verify-batch (POS)
│   │   ├── alerts.py           # GET /alerts
│   │   └── files.py            # POST /batch/{id}/certificate-file (local storage + SHA-256)
│   └── seed_data.py            # 10 batches, 6 actors, 5 users
├── init.sql                    # exact PostgreSQL DDL + indexes
├── requirements.txt
├── Dockerfile
└── storage/                    # keys/ + certificates/ (created at runtime, git-ignored)
```

## Key endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | JWT login `{username, password}` |
| GET | `/auth/me` | JWT | current user |
| POST | `/batch` | Manufacturer | create ACTIVE batch |
| GET | `/batches` | JWT | list + filters |
| GET | `/batch/{id}` | JWT | detail + history |
| POST | `/batch/{id}/return` | Pharmacy | ACTIVE → LOGGED_FOR_RETURN |
| POST | `/batch/{id}/schedule-pickup` | Distributor | → PICKUP_SCHEDULED |
| POST | `/batch/{id}/receive` | Distributor | quantity check → RECEIVED or DISPUTED |
| POST | `/batch/{id}/raise-dispute` | Distributor | → DISPUTED |
| POST | `/batch/{id}/resolve-dispute` | Distributor | DISPUTED → RECEIVED (reconciliation event) |
| POST | `/batch/{id}/destruction-ready` | Manufacturer | → WAITING_FOR_DESTRUCTION |
| POST | `/batch/{id}/destroy` | Manufacturer | → DESTROYED (embeds cert hash) |
| POST | `/batch/{id}/certificate-file` | Manufacturer | multipart `file` → local storage + SHA-256 |
| POST | `/verify-batch` | JWT | POS check → SALE_BLOCKED event + alert |
| GET | `/ledger?batch_id=` | JWT | annotated audit events + integrity |
| GET | `/batches/{id}/verify-integrity` | JWT | `{integrity_valid, events_verified, signatures_verified}` or `HASH_CHAIN_TAMPER_DETECTED` |
| GET | `/alerts` | JWT | fraud alerts |
| GET | `/stats` | JWT | dashboard KPIs |
| POST | `/seed` | — | reset + load demo data |

## Security notes

- Private Ed25519 keys are derived from `HASHCHAIN_SECRET + actor_id` and kept in `storage/keys/` — **never in the database** (only `actors.public_key` is stored).
- `audit_events` has **no update/delete endpoint**; corrections are new signed events.
- Tamper-evidence (accurate claim): any modification, deletion, insertion, or reordering breaks hash/signature verification — demonstrated via `GET /batches/{id}/verify-integrity`.
