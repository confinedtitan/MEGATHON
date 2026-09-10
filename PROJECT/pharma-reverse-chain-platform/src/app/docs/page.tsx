"use client";
import { Card, PageHeader, Shell } from "@/components/ui";

const ENDPOINTS: { method: string; path: string; desc: string; body?: string; resp?: string }[] = [
  {
    method: "POST",
    path: "/batch",
    desc: "Create a batch (starts ACTIVE, appends signed BATCH_CREATED event)",
    body: `{ "batch_number": "NV-XXX-0001", "medicine_name": "Drug 10mg", "manufacturer_name": "NovaGen Labs", "expiry_date": "2027-01-01", "quantity": 1000 }`,
  },
  { method: "GET", path: "/batches?status=ACTIVE&search=para", desc: "List batches with optional filters" },
  { method: "GET", path: "/batch/{id}", desc: "Batch detail + annotated audit history + integrity summary" },
  { method: "GET", path: "/batch/number/{batchNumber}", desc: "Same as above, looked up by batch number (powers the timeline page)" },
  {
    method: "POST",
    path: "/batch/{id}/return",
    desc: "ACTIVE → LOGGED_FOR_RETURN (Pharmacy) + signed event",
    body: `{ "actor_name": "CityCare Pharmacy", "actor_role": "Pharmacy", "remarks": "Expired stock" }`,
  },
  { method: "POST", path: "/batch/{id}/schedule-pickup", desc: "LOGGED_FOR_RETURN → PICKUP_SCHEDULED (Distributor) + signed event" },
  {
    method: "POST",
    path: "/batch/{id}/receive",
    desc: "PICKUP_SCHEDULED → RECEIVED_BY_DISTRIBUTOR. Include received_quantity — a mismatch appends a signed QUANTITY_DISCREPANCY event and moves to DISPUTED.",
    body: `{ "actor_name": "MediTrans Logistics", "received_quantity": 3000 }`,
  },
  {
    method: "POST",
    path: "/batch/{id}/raise-dispute",
    desc: "→ DISPUTED with signed DISPUTE_RAISED event",
    body: `{ "actor_name": "MediTrans Logistics", "reason": "Broken seals" }`,
  },
  { method: "POST", path: "/batch/{id}/resolve-dispute", desc: "DISPUTED → RECEIVED_BY_DISTRIBUTOR via signed DISPUTE_RESOLVED reconciliation event (history is never rewritten)", body: `{ "resolution": "Recount OK" }` },
  { method: "POST", path: "/batch/{id}/destruction-ready", desc: "RECEIVED_BY_DISTRIBUTOR → WAITING_FOR_DESTRUCTION (Manufacturer) + signed event" },
  { method: "POST", path: "/batch/{id}/destroy", desc: "WAITING_FOR_DESTRUCTION → DESTROYED (terminal) + signed DESTRUCTION_VERIFIED event containing the certificate SHA-256" },
  {
    method: "POST",
    path: "/batch/{id}/certificate",
    desc: "Upload destruction certificate PDF (multipart field `file`) → stored in local storage, SHA-256 pinned to batch and embedded in the destruction event",
  },
  {
    method: "POST",
    path: "/verify-batch",
    desc: "POS sale verification. Non-ACTIVE → blocked + signed SALE_BLOCKED audit event + fraud alert.",
    body: `{ "batch_id": "NV-CET-1008", "pharmacy_name": "CityCare Pharmacy" }`,
    resp: `{ "allowed": false, "reason": "BATCH_NOT_ELIGIBLE_FOR_SALE" }`,
  },
  { method: "GET", path: "/ledger?batch_id=NV-...", desc: "Signed audit events (annotated with hash/signature validity) + integrity report" },
  {
    method: "GET",
    path: "/batches/{batch_id}/verify-integrity",
    desc: "Recompute every hash, check every link, verify every signature for one batch.",
    resp: `{ "batch_id": "NV-CET-1008", "integrity_valid": true, "events_verified": 6, "signatures_verified": 6 }`,
  },
  { method: "GET", path: "/api/integrity", desc: "Per-batch integrity summaries for the regulator dashboard" },
  { method: "GET", path: "/alerts", desc: "All fraud alerts (blocked sale attempts)" },
];

export default function DocsPage() {
  return (
    <Shell>
      <PageHeader
        title="API Documentation & Setup"
        subtitle="Endpoints, data model, cryptography, tamper-evidence guarantees, and demo guide."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="🗄 Database schema (PostgreSQL + Drizzle)" subtitle="src/db/schema.ts — no blockchain anywhere">
          <pre className="slim-scroll overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-300">
{`medicine_batches
  id · batch_number UNIQUE · medicine_name
  manufacturer_name · expiry_date · quantity
  current_status · created_at · updated_at
  certificate_hash · certificate_filename
  discrepancy_reason

audit_events  (append-only cryptographic ledger)
  id BIGSERIAL PK · batch_id VARCHAR(100)
  event_type VARCHAR(100) · event_data JSONB
  previous_hash VARCHAR(64) · event_hash VARCHAR(64)
  actor_id VARCHAR(100) · actor_role VARCHAR(50)
  digital_signature TEXT · timestamp TIMESTAMPTZ
  INDEXES: batch_id · timestamp · event_hash
           previous_hash

fraud_alerts
  alert_id · batch_number · pharmacy_name
  timestamp · batch_status

actors
  id · actor_id UNIQUE · name · role
  location · public_key  (verification keys only)`}
          </pre>
        </Card>
        <Card title="🚀 Setup instructions" subtitle="From zero to demo in 3 steps">
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <b>1. Install & configure.</b> <span className="font-mono text-xs">npm install</span> then
              set <span className="font-mono text-xs">DATABASE_URL</span> in{" "}
              <span className="font-mono text-xs">.env</span>. Optionally set{" "}
              <span className="font-mono text-xs">HASHCHAIN_SECRET</span> (signing-key seed; a dev
              default is used otherwise).
            </li>
            <li className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <b>2. Push schema.</b> <span className="font-mono text-xs">npx drizzle-kit push</span>{" "}
              creates the four tables plus audit indexes.
            </li>
            <li className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <b>3. Seed & run.</b> <span className="font-mono text-xs">npm run build && npm start</span>{" "}
              (or <span className="font-mono text-xs">npm run dev</span>), then click{" "}
              <b>“Load demo data”</b> on the Overview page — or{" "}
              <span className="font-mono text-xs">POST /api/seed</span>. 10 batches, 6 actors with
              Ed25519 keys, full signed audit history and 1 starter alert are created.
            </li>
            <li className="rounded-xl bg-emerald-50 p-3 text-emerald-900 ring-1 ring-emerald-200">
              <b>Local storage:</b> certificates land in{" "}
              <span className="font-mono text-xs">storage/certificates/&lt;batchId&gt;/</span> and
              signing keys in <span className="font-mono text-xs">storage/keys/</span>. Private keys
              are never stored in the database.
            </li>
          </ol>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="🔏 Cryptography & tamper-evidence" subtitle="What the system guarantees — stated accurately">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-200">
              <p className="font-bold text-emerald-300">Hash chaining (SHA-256)</p>
              <p className="mt-1">event_hash = SHA256(batch_id | event_type | canonical(event_data) | actor_id | timestamp | previous_hash)</p>
              <p className="mt-3 font-bold text-emerald-300">Signatures (Ed25519)</p>
              <p className="mt-1">signature = Sign(private_key, event_hash)</p>
              <p>Verify(public_key, event_hash, signature)</p>
              <p className="mt-3 font-bold text-emerald-300">Verification</p>
              <p className="mt-1">GET /batches/{"{batch_id}"}/verify-integrity recomputes every hash, checks every link, verifies every signature.</p>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <blockquote className="rounded-xl bg-amber-50 p-4 italic text-amber-900 ring-1 ring-amber-200">
                “The audit trail is cryptographically tamper-evident. Any modification, deletion,
                insertion, or reordering of historical events will break the hash chain and/or
                digital signature verification.” A hash chain does not make the database itself
                impossible to modify — it makes any modification detectable.
              </blockquote>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                <p className="font-bold">Append-only enforcement</p>
                <p className="mt-1 text-[13px]">The application exposes no PUT/DELETE endpoint for audit records — only new events can be appended. Corrections are new signed events (DISPUTE_RESOLVED), never rewrites.</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                <p className="font-bold">Production hardening (example, not enabled in demo so tampering can be demonstrated)</p>
                <pre className="slim-scroll mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-200">
{`REVOKE UPDATE, DELETE ON audit_events FROM app_user;
-- and/or a trigger that raises an exception on
-- UPDATE/DELETE of audit_events.`}
                </pre>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title="🔌 APIs — all implemented"
          subtitle="Exact paths live on this server. The frontend uses axios against them."
        >
          <div className="space-y-3">
            {ENDPOINTS.map((e) => (
              <div key={e.method + e.path} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs font-black text-white ${
                      e.method === "GET" ? "bg-sky-600" : "bg-emerald-600"
                    }`}
                  >
                    {e.method}
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-900">{e.path}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{e.desc}</p>
                {e.body && (
                  <pre className="slim-scroll mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-200">
                    {e.body}
                  </pre>
                )}
                {e.resp && (
                  <pre className="slim-scroll mt-2 overflow-x-auto rounded-lg bg-red-950 p-3 font-mono text-[11px] text-red-200">
                    {e.resp}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card title="🔒 State transition rules" subtitle="Enforced server-side in src/lib/pharma.ts">
          <pre className="slim-scroll overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-200">
{`ALLOWED
  ACTIVE                  → LOGGED_FOR_RETURN
  LOGGED_FOR_RETURN       → PICKUP_SCHEDULED
  PICKUP_SCHEDULED        → RECEIVED_BY_DISTRIBUTOR
  RECEIVED_BY_DISTRIBUTOR → WAITING_FOR_DESTRUCTION
  WAITING_FOR_DESTRUCTION → DESTROYED
  DISPUTED                → RECEIVED_BY_DISTRIBUTOR
  PICKUP_SCHEDULED        → DISPUTED  (qty mismatch)
  RECEIVED_BY_DISTRIBUTOR → DISPUTED  (qty mismatch)

FORBIDDEN (→ HTTP 422)
  DESTROYED → anything            (terminal)
  * → ACTIVE                      (no resurrection)
  RECEIVED_BY_DISTRIBUTOR → ACTIVE
  WAITING_FOR_DESTRUCTION → ACTIVE`}
          </pre>
        </Card>
        <Card title="📦 Sample seed data + tamper demo" subtitle="POST /api/seed">
          <ul className="space-y-1.5 text-sm text-slate-700">
            <li>💊 <b>10 batches</b> — NV-AMX-1001 … NV-INS-1010, spanning every lifecycle stage</li>
            <li>🏪 <b>2 pharmacies</b> — CityCare (PHARMACY_001), GreenCross (PHARMACY_002)</li>
            <li>🚚 <b>2 distributors</b> — MediTrans, SwiftPharma</li>
            <li>🏭 <b>1 manufacturer</b> — NovaGen Labs</li>
            <li>🏛 <b>1 regulator</b> — National Drug Authority</li>
            <li>🔏 Full SHA-256 hash-chained, Ed25519-signed audit history per batch</li>
            <li>🚨 1 starter fraud alert + SALE_BLOCKED event</li>
          </ul>
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-[13px] text-red-900 ring-1 ring-red-200">
            <b>🧪 Tamper demo:</b> open the Audit Ledger (or a batch timeline), click{" "}
            <b>“Simulate database tampering”</b>, then re-run verification →{" "}
            <span className="font-mono font-bold">HASH_CHAIN_TAMPER_DETECTED</span> with the invalid
            record id. Manually: <span className="font-mono text-xs">UPDATE audit_events SET event_data = … WHERE id = …</span> then{" "}
            <span className="font-mono text-xs">GET /batches/{"{id}"}/verify-integrity</span>. Restore with{" "}
            <span className="font-mono text-xs">POST /api/seed</span>.
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 ring-1 ring-slate-100">
            Architecture: <span className="font-mono">React → API backend → PostgreSQL (application tables + cryptographic audit ledger: SHA-256 hash chain + Ed25519 signatures)</span>. No blockchain.
          </div>
        </Card>
      </div>
    </Shell>
  );
}
