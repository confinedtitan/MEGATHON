"use client";
import axios from "axios";

export const api = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

export type Batch = {
  id: number;
  batchNumber: string;
  medicineName: string;
  manufacturerName: string;
  expiryDate: string;
  quantity: number;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
  certificateHash: string | null;
  certificateFilename: string | null;
  discrepancyReason: string | null;
};

export type AuditEvent = {
  id: number;
  batchId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  previousHash: string;
  eventHash: string;
  actorId: string;
  actorRole: string;
  actorName: string | null;
  digitalSignature: string;
  timestamp: string;
  hashValid: boolean;
  signatureValid: boolean;
};

export type Alert = {
  alertId: number;
  batchNumber: string;
  pharmacyName: string;
  timestamp: string;
  batchStatus: string;
};

export type IntegritySummary = {
  batch_number: string;
  medicine_name: string;
  status: string;
  integrity_valid: boolean;
  events: number;
  signatures: number;
  invalid_record_id?: number;
  reason?: string;
};

export async function fetchBatches(status?: string, search?: string): Promise<Batch[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (search) params.search = search;
  const r = await api.get("/batches", { params });
  return r.data.batches;
}

export async function fetchBatch(id: number) {
  const r = await api.get(`/batch/${id}`);
  return r.data as { batch: Batch; history: AuditEvent[]; integrity: unknown };
}

export async function fetchBatchByNumber(batchNumber: string) {
  const r = await api.get(`/batch/number/${encodeURIComponent(batchNumber)}`);
  return r.data as {
    batch: Batch;
    history: AuditEvent[];
    integrity: { valid: boolean; events?: number; signatures?: number; invalid_record_id?: number; reason?: string };
  };
}

export async function postTransition(
  id: number,
  action: string,
  body: Record<string, unknown> = {}
) {
  const r = await api.post(`/batch/${id}/${action}`, body);
  return r.data as { batch: Batch; audit_event: AuditEvent; disputed?: boolean };
}

export async function verifyBatch(batch_number: string, pharmacy_name: string) {
  const r = await api.post("/verify-batch", { batch_id: batch_number, pharmacy_name });
  return r.data as {
    allowed: boolean;
    reason?: string;
    message?: string;
    status?: string;
    medicine_name?: string;
    batch_id?: string;
    alert_id?: number;
  };
}

export async function fetchAuditLedger(batch_id?: string) {
  const r = await api.get("/ledger", { params: batch_id ? { batch_id } : {} });
  return r.data as {
    audit_events: AuditEvent[];
    count: number;
    integrity: {
      valid: boolean;
      events: number;
      batches?: number;
      signatures?: number;
      invalid_batch?: string;
      invalid_record_id?: number;
      reason?: string;
    };
  };
}

export async function verifyIntegrity(batchNumber: string) {
  const r = await api.get(`/batches/${encodeURIComponent(batchNumber)}/verify-integrity`);
  return r.data as {
    batch_id: string;
    integrity_valid: boolean;
    events_verified?: number;
    signatures_verified?: number;
    error?: string;
    invalid_record_id?: number;
    detail?: string;
  };
}

export async function fetchIntegritySummary(status?: string, search?: string) {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (search) params.search = search;
  const r = await api.get("/api/integrity", { params });
  return r.data as {
    batches: IntegritySummary[];
    summary: { total: number; valid: number; invalid: number };
  };
}

export async function tamperDemo(batch_number: string) {
  const r = await api.post("/api/demo/tamper", { batch_number });
  return r.data as {
    tampered: boolean;
    batch_number: string;
    tampered_record_id: number;
    event_type: string;
    note: string;
  };
}

export async function fetchAlerts(): Promise<Alert[]> {
  const r = await api.get("/alerts");
  return r.data.alerts;
}

export async function fetchStats() {
  const r = await api.get("/api/stats");
  return r.data as {
    totalBatches: number;
    byStatus: Record<string, number>;
    totalAuditEvents: number;
    totalAlerts: number;
    blockedBatches: number;
    sellableBatches: number;
  };
}

export async function uploadCertificate(id: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const r = await api.post(`/batch/${id}/certificate`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function createBatch(body: Record<string, unknown>) {
  const r = await api.post("/batch", body);
  return r.data;
}

export async function seedDemo() {
  const r = await api.post("/api/seed");
  return r.data;
}
