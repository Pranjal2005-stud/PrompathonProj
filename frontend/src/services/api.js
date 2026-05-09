import axios from "axios";

const BASE = "http://localhost:8000";

const api = axios.create({ baseURL: BASE });

export const uploadInvoices = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/predict", fd, { headers: { "Content-Type": "multipart/form-data" } });
};

export const getSummary = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/summary", fd, { headers: { "Content-Type": "multipart/form-data" } });
};

export const askCopilot = async (question, context) => {
  const res = await api.post("/copilot", { question, context });
  return res.data;
};

export const getAIExplanation = async (invoice) => {
  const res = await api.post("/explain", { invoice });
  return res.data;
};
