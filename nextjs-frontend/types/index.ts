export type Decision = "BLOCK" | "REVIEW" | "APPROVE";
export type AlertLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Invoice {
  invoice_id: string | number;
  vendor_id?: string;
  vendor_name?: string;
  invoice_amount?: number;
  approved_amount_po?: number;
  quantity?: number;
  approved_quantity_po?: number;
  paid_amount?: number;
  invoice_date?: string;
  decision: Decision;
  risk_score?: number;
  ml_risk_score?: number;
  rule_score?: number;
  behavior_score?: number;
  data_confidence?: number;
  fraud_type?: string;
  rule_flags?: string;
  reason?: string;
  alert_level?: AlertLevel;
  network_risk_score?: number;
  shared_bank_account?: number;
  created_at?: string;
  cluster_id?: string;
}

export interface SeverityConfig {
  color: string;
  bg: string;
  border: string;
  dot?: string;
}

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

export interface ChatMessage {
  role: "ai" | "user";
  text: string;
  time: string;
  error?: boolean;
}

export interface AISection {
  title: string | null;
  lines: string[];
}

export type PageId =
  | "dashboard"
  | "alerts"
  | "vendors"
  | "analytics"
  | "invoices"
  | "queue"
  | "forensic"
  | "reports"
  | "settings";
