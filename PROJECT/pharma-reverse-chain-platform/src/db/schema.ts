import {
  pgTable,
  serial,
  bigserial,
  text,
  varchar,
  integer,
  timestamp,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ── Medicine Batch ──────────────────────────────────────────────
export const medicineBatches = pgTable("medicine_batches", {
  id: serial("id").primaryKey(),
  batchNumber: text("batch_number").notNull().unique(),
  medicineName: text("medicine_name").notNull(),
  manufacturerName: text("manufacturer_name").notNull(),
  expiryDate: date("expiry_date").notNull(),
  quantity: integer("quantity").notNull(),
  currentStatus: text("current_status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  certificateHash: text("certificate_hash"),
  certificateFilename: text("certificate_filename"),
  discrepancyReason: text("discrepancy_reason"),
});

export type MedicineBatch = typeof medicineBatches.$inferSelect;
export type NewMedicineBatch = typeof medicineBatches.$inferInsert;

// ── Cryptographic audit ledger (append-only hash chain in PostgreSQL)
// There is NO blockchain. Every lifecycle event appends one signed record
// whose event_hash cryptographically depends on the previous record.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    batchId: varchar("batch_id", { length: 100 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    eventData: jsonb("event_data")
      .$type<Record<string, unknown>>()
      .notNull(),
    previousHash: varchar("previous_hash", { length: 64 }).notNull(),
    eventHash: varchar("event_hash", { length: 64 }).notNull(),
    actorId: varchar("actor_id", { length: 100 }).notNull(),
    actorRole: varchar("actor_role", { length: 50 }).notNull(),
    digitalSignature: text("digital_signature").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_batch_idx").on(t.batchId),
    index("audit_ts_idx").on(t.timestamp),
    index("audit_hash_idx").on(t.eventHash),
    index("audit_prev_idx").on(t.previousHash),
  ]
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

// ── Fraud alerts ────────────────────────────────────────────────
export const fraudAlerts = pgTable("fraud_alerts", {
  alertId: serial("alert_id").primaryKey(),
  batchNumber: text("batch_number").notNull(),
  pharmacyName: text("pharmacy_name").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  batchStatus: text("batch_status").notNull(),
});

export type FraudAlert = typeof fraudAlerts.$inferSelect;
export type NewFraudAlert = typeof fraudAlerts.$inferInsert;

// ── Actors / organisations (public verification keys only —
// private signing keys are NEVER stored in the database) ─────────
export const actors = pgTable("actors", {
  id: serial("id").primaryKey(),
  actorId: varchar("actor_id", { length: 100 }).notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  location: text("location").notNull(),
  publicKey: text("public_key"),
});

export type Actor = typeof actors.$inferSelect;
export type NewActor = typeof actors.$inferInsert;
