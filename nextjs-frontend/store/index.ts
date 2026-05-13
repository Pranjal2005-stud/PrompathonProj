import { create } from "zustand";
import type { Invoice, Toast, PageId, ChatMessage } from "@/types";

let toastId = 0;

interface AppState {
  // Data
  invoices: Invoice[];
  loading: boolean;
  error: string | null;

  // UI
  activePage: PageId;
  selectedInvoice: Invoice | null;
  filter: string;
  search: string;

  // Toasts
  toasts: Toast[];

  // Chat
  chatMessages: ChatMessage[];
  chatOpen: boolean;
  chatExpanded: boolean;

  // Actions
  setInvoices: (data: Invoice[]) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setActivePage: (p: PageId) => void;
  setSelectedInvoice: (inv: Invoice | null) => void;
  setFilter: (f: string) => void;
  setSearch: (s: string) => void;
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: number) => void;
  setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  setChatOpen: (v: boolean) => void;
  setChatExpanded: (v: boolean | ((e: boolean) => boolean)) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  invoices: [],
  loading: false,
  error: null,
  activePage: "dashboard",
  selectedInvoice: null,
  filter: "ALL",
  search: "",
  toasts: [],
  chatMessages: [
    {
      role: "ai",
      text: "Hello! I'm your **AI Fraud Investigator** powered by Groq.\n\nAsk me about fraud patterns, vendor risks, or invoice anomalies.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ],
  chatOpen: false,
  chatExpanded: false,

  setInvoices: (data) => set({ invoices: data }),
  setLoading: (v) => set({ loading: v }),
  setError: (v) => set({ error: v }),
  setActivePage: (p) => set({ activePage: p }),
  setSelectedInvoice: (inv) => set({ selectedInvoice: inv }),
  setFilter: (f) => set({ filter: f }),
  setSearch: (s) => set({ search: s }),

  addToast: (message, type = "info") => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setChatMessages: (msgs) =>
    set((s) => ({
      chatMessages: typeof msgs === "function" ? msgs(s.chatMessages) : msgs,
    })),
  setChatOpen: (v) => set({ chatOpen: v }),
  setChatExpanded: (v: boolean | ((e: boolean) => boolean)) => set((s) => ({ chatExpanded: typeof v === "function" ? v(s.chatExpanded) : v })),

  reset: () =>
    set({ invoices: [], filter: "ALL", search: "", error: null, selectedInvoice: null }),
}));
