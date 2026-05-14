import axios from "axios";
import type { Invoice } from "@/types";

const api = axios.create({ baseURL: "/api/backend" });

export const uploadInvoices = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post<Invoice[]>("/predict", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const fetchKPI = () =>
  api.get<{
    total: number; fraud_detected: number; blocked: number;
    review: number; approved: number; fraud_rate: number;
    amount_saved: number; critical_count: number;
    high_count: number; avg_risk_score: number;
  }>("/kpi").then((r) => r.data);

export const fetchAlerts = (page = 1, perPage = 50, severity?: string) =>
  api.get<{ alerts: Invoice[]; total: number; page: number; per_page: number }>(
    "/alerts",
    { params: { page, per_page: perPage, ...(severity ? { severity } : {}) } }
  ).then((r) => r.data);

export const fetchTransactions = (
  page = 1, perPage = 50, decision?: string, minRisk?: number
) =>
  api.get<{ transactions: Invoice[]; total: number; page: number; per_page: number }>(
    "/transactions",
    { params: { page, per_page: perPage, ...(decision ? { decision } : {}), ...(minRisk ? { min_risk: minRisk } : {}) } }
  ).then((r) => r.data);

export const askCopilot = async (question: string, context: string) => {
  const res = await api.post<{ answer: string }>("/copilot", { question, context });
  return res.data;
};

export const getAIExplanation = async (invoice: Invoice): Promise<string> => {
  const res = await api.post<{ explanation: string }>("/explain", { invoice });
  return res.data.explanation;
};

export const submitReviewerAction = async (
  invoice_id: string | number,
  action: string,
  note = "",
  reviewer = "Auditor"
) => {
  const res = await api.post("/review/action", { invoice_id, action, note, reviewer });
  return res.data;
};
