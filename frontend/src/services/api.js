import axios from "axios";

const BASE_URL = "http://localhost:8000";

export const uploadInvoices = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return axios.post(`${BASE_URL}/predict`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
