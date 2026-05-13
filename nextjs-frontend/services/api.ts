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
