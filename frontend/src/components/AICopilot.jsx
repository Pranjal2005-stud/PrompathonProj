import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, User, Sparkles, ShieldAlert, TrendingUp, Search, BarChart2, RotateCcw, Loader2 } from "lucide-react";
import { askCopilot } from "../services/api";

const SUGGESTIONS = [
  { icon: ShieldAlert, text: "Why was the last invoice blocked?",    color: "#dc2626" },
  { icon: TrendingUp,  text: "Which vendor has the highest risk?",   color: "#d97706" },
  { icon: Search,      text: "Show duplicate invoice patterns",       color: "#7c3aed" },
  { icon: BarChart2,   text: "What is the fraud rate this session?", color: "#2563eb" },
];

function buildContext(data) {
  if (!data.length) return "No invoices loaded yet.";
  const blocked  = data.filter(d => d.decision === "BLOCK").length;
  const review   = data.filter(d => d.decision === "REVIEW").length;
  const topRisk  = [...data]
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 3)
    .map(d => `${d.vendor_name} (risk: ${(d.risk_score || 0).toFixed(0)}, reason: ${d.reason || "anomaly"})`)
    .join("; ");
  return `Total: ${data.length}. Blocked: ${blocked}. Review: ${review}. Approved: ${data.length - blocked - review}. Top risky: ${topRisk}.`;
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AICopilot({ data = [] }) {
  const [messages, setMessages] = useState([{
    role: "ai",
    text: "Hello! I'm your AI Fraud Auditor powered by Groq LLM. I can analyze invoice data, explain anomalies, identify fraud patterns, and provide actionable recommendations. What would you like to investigate?",
    time: ts(),
  }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");
    inputRef.current?.focus();
    setMessages(prev => [...prev, { role: "user", text: q, time: ts() }]);
    setLoading(true);
    try {
      const json = await askCopilot(q, buildContext(data));
      setMessages(prev => [...prev, { role: "ai", text: json.answer || "No response from AI.", time: ts() }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "ai",
        text: `Unable to reach the AI backend.\n\nEnsure FastAPI is running on port 8000 and GROQ_API_KEY is set in backend/.env\n\nError: ${err.message}`,
        time: ts(),
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const blocked = data.filter(d => d.decision === "BLOCK").length;
  const avgRisk = data.length
    ? (data.reduce((s, d) => s + (d.risk_score || 0), 0) / data.length).toFixed(1)
    : "—";

  return (
    <div className="grid grid-cols-3 gap-5" style={{ height: "620px" }}>

      {/* Left panel */}
      <div className="flex flex-col gap-4">

        {/* Status card */}
        <div
          className="rounded-xl p-5"
          style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#eff6ff" }}>
              <Bot size={16} style={{ color: "#2563eb" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">AI Fraud Copilot</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-xs text-slate-400">Groq · llama-3.3-70b-versatile</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { label: "Invoices Loaded", value: data.length || "—", color: "#2563eb" },
              { label: "Blocked",         value: blocked || "—",     color: "#dc2626" },
              { label: "Avg Risk Score",  value: avgRisk,            color: "#7c3aed" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
              >
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-sm font-semibold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        <div
          className="rounded-xl p-5 flex-1"
          style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Suggested Questions
          </p>
          <div className="space-y-2">
            {SUGGESTIONS.map(({ icon: Icon, text, color }) => (
              <button
                key={text}
                onClick={() => send(text)}
                disabled={loading}
                className="w-full flex items-start gap-3 px-3.5 py-3 rounded-lg text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <Icon size={13} className="shrink-0 mt-0.5" style={{ color }} />
                <span className="text-xs text-slate-600 leading-relaxed">{text}</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Chat panel */}
      <div
        className="col-span-2 rounded-xl flex flex-col overflow-hidden"
        style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        {/* Chat header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: "#e2e8f0" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: "#7c3aed" }} />
            <p className="text-sm font-semibold text-slate-700">Conversation</p>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "#f5f3ff", color: "#7c3aed" }}
            >
              {messages.length - 1} messages
            </span>
          </div>
          <button
            onClick={() => setMessages([{ role: "ai", text: "Chat cleared. How can I help?", time: ts() }])}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw size={11} />
            Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={m.role === "ai"
                    ? { background: m.error ? "#fef2f2" : "#f5f3ff" }
                    : { background: "#eff6ff" }}
                >
                  {m.role === "ai"
                    ? <Sparkles size={12} style={{ color: m.error ? "#dc2626" : "#7c3aed" }} />
                    : <User size={12} style={{ color: "#2563eb" }} />}
                </div>

                <div className={`flex flex-col gap-1 max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className="px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={m.role === "ai"
                      ? {
                          background: m.error ? "#fef2f2" : "#f8fafc",
                          color: m.error ? "#dc2626" : "#334155",
                          border: `1px solid ${m.error ? "#fecaca" : "#e2e8f0"}`,
                        }
                      : { background: "#2563eb", color: "#ffffff" }}
                  >
                    {m.text}
                  </div>
                  <span className="text-[10px] text-slate-400 px-1">{m.time}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#f5f3ff" }}>
                <Loader2 size={12} style={{ color: "#7c3aed" }} className="animate-spin" />
              </div>
              <div
                className="px-4 py-3 rounded-xl"
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
              >
                <div className="flex gap-1 items-center h-4">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: "#e2e8f0" }}>
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
            style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && !loading && send()}
              placeholder="Ask about fraud patterns, vendors, risk scores…"
              className="flex-1 text-sm text-slate-700 bg-transparent outline-none placeholder:text-slate-400"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90 shrink-0"
              style={{ background: "#2563eb" }}
            >
              <Send size={13} />
              Send
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Requires FastAPI on port 8000 · GROQ_API_KEY in backend/.env
          </p>
        </div>
      </div>

    </div>
  );
}
