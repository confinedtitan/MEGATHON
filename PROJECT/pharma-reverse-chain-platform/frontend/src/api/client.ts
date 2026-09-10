import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pharma_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("pharma_token");
      localStorage.removeItem("pharma_user");
      if (!window.location.pathname.includes("/login")) window.location.href = "/login";
    }
    throw err;
  }
);

export interface Batch {
  id: number;
  batch_number: string;
  medicine_name: string;
  manufacturer_name: string;
  expiry_date: string;
  quantity: number;
  current_status: string;
  created_at: string;
  updated_at: string;
  certificate_hash: string | null;
  certificate_filename: string | null;
  discrepancy_reason: string | null;
}

export interface AuditEvent {
  id: number;
  batch_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  previous_hash: string;
  event_hash: string;
  actor_id: string;
  actor_role: string;
  actor_name: string | null;
  digital_signature: string;
  timestamp: string;
  hash_valid: boolean;
  signature_valid: boolean;
}

export const login = (username: string, password: string) =>
  api.post("/auth/login", { username, password }).then((r) => r.data);

export const fetchBatches = (status?: string, search?: string): Promise<Batch[]> =>
  api.get("/batches", { params: { ...(status ? { status } : {}), ...(search ? { search } : {}) } }).then((r) => r.data.batches);

export const postTransition = (id: number, action: string, body: Record<string, unknown> = {}) =>
  api.post(`/batch/${id}/${action}`, body).then((r) => r.data);

export const verifyBatch = (batch_id: string, pharmacy_name: string) =>
  api.post("/verify-batch", { batch_id, pharmacy_name }).then((r) => r.data);

export const fetchLedger = (batch_id?: string) =>
  api.get("/ledger", { params: batch_id ? { batch_id } : {} }).then((r) => r.data);

export const verifyIntegrity = (batchNumber: string) =>
  api.get(`/batches/${encodeURIComponent(batchNumber)}/verify-integrity`).then((r) => r.data);

export const fetchAlerts = () => api.get("/alerts").then((r) => r.data.alerts);

export const fetchStats = () => api.get("/stats").then((r) => r.data);

export const uploadCertificate = (id: number, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/batch/${id}/certificate-file`, form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

export const createBatch = (body: Record<string, unknown>) => api.post("/batch", body).then((r) => r.data);
export const seedDemo = () => api.post("/seed").then((r) => r.data);
