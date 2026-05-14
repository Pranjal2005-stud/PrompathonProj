"use client";
import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, User, Sparkles, ShieldAlert, TrendingUp,
  BarChart2, RotateCcw, Loader2, AlertOctagon, Users, FileText,
  Maximize2, Minimize2, X, MessageSquare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAppStore } from "@/store";
import { askCopilot } from "@/services/api";
import { buildCopilotContext } from "@/lib/utils";

const SUGGESTIONS = [
  { icon: ShieldAlert,  text: "Why was this invoice flagged?",    color: "#dc2626" },
  { icon: AlertOctagon, text: "Explain shell vendor fraud",        color: "#7c3aed" },
  { icon: TrendingUp,   text: "Which vendors are highest risk?",   color: "#d97706" },
  { icon: BarChart2,    text: "Summarize today's fraud alerts",    color: "#2563eb" },
  { icon: Users,        text: "What evidence suggests collusion?", color: "#059669" },
  { icon: FileText,     text: "Generate investigation summary",    color: "#0891b2" },
];

function ts() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

function AIMessage({ text, error }: { text: string; error?: boolean }) {
  const isCritical = /(critical|shell vendor|collusion|immediate|block)/i.test(text);
  return (
    <div className="space-y-1.5">
      {isCritical && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <AlertOctagon size={11} className="text-red-600" />
          <span className="text-[10px] font-bold text-red-600">CRITICAL FINDING</span>
        </div>
      )}
      <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
        style={error ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" } : { background: "#f8fafc", color: "#334155", border: "1px solid #e2e8f0" }}>
        <ReactMarkdown components={{
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1.5">{children}</ul>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
        }}>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

const AICopilot = memo(function AICopilot() {
  const {
    invoices, chatMessages, chatOpen, chatExpanded,
    setChatMessages, setChatOpen, setChatExpanded,
  } = useAppStore();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const blocked   = invoices.filter((d) => d.decision === "BLOCK").length;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, loading]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    inputRef.current?.focus();
    setChatMessages((prev) => [...prev, { role: "user", text: q, time: ts() }]);
    setLoading(true);
    try {
      const json = await askCopilot(q, buildCopilotContext(invoices));
      setChatMessages((prev) => [...prev, { role: "ai", text: json.answer ?? "No response.", time: ts() }]);
    } catch (err: unknown) {
      setChatMessages((prev) => [...prev, {
        role: "ai",
        text: `Unable to reach AI backend.\n\nEnsure FastAPI is running on port 8000.\n\nError: ${err instanceof Error ? err.message : "Unknown"}`,
        time: ts(), error: true,
      }]);
    } finally { setLoading(false); }
  };

  const W = chatExpanded ? 820 : 380;

  return (
    <>
      {/* Floating button to open chat */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", boxShadow: "0 8px 32px rgba(37,99,235,0.4)" }}
          >
            <MessageSquare size={22} />
            {blocked > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse bg-red-600">
                {blocked > 9 ? "9+" : blocked}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden bg-white"
            style={{
              width: `${W}px`, height: "520px",
              borderRadius: "20px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
              border: "1px solid #e2e8f0",
              transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 shrink-0"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", borderRadius: "20px 20px 0 0" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Bot size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">AI Fraud Copilot</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] text-white/70">Groq · llama-3.3-70b-versatile</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setChatExpanded((e: boolean) => !e)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  {chatExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button onClick={() => { setChatOpen(false); setChatExpanded(false); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={13} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <AnimatePresence>
                {chatExpanded && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }} animate={{ width: 220, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="shrink-0 overflow-hidden flex flex-col border-r border-slate-50"
                  >
                    <div className="p-4 flex-1 overflow-y-auto">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Quick Investigations</p>
                      <div className="space-y-1.5">
                        {SUGGESTIONS.map(({ icon: Icon, text, color }) => (
                          <button key={text} onClick={() => send(text)} disabled={loading}
                            className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            style={{ border: "1px solid #f1f5f9" }}>
                            <Icon size={11} className="shrink-0 mt-0.5" style={{ color }} />
                            <span className="text-xs text-slate-600 leading-relaxed">{text}</span>
                          </button>
                        ))}
                      </div>
                      {invoices.length > 0 && (
                        <div className="mt-4 space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Session Stats</p>
                          {[
                            { label: "Invoices", value: invoices.length, color: "#2563eb" },
                            { label: "Blocked",  value: blocked,         color: "#dc2626" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                              <span className="text-xs text-slate-500">{label}</span>
                              <span className="text-sm font-bold" style={{ color }}>{value || "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  <AnimatePresence initial={false}>
                    {chatMessages.map((m, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                        className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={m.role === "ai" ? { background: m.error ? "#fef2f2" : "#f5f3ff" } : { background: "#eff6ff" }}>
                          {m.role === "ai" ? <Sparkles size={11} style={{ color: m.error ? "#dc2626" : "#7c3aed" }} /> : <User size={11} className="text-blue-600" />}
                        </div>
                        <div className={`flex flex-col gap-1 max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                          {m.role === "ai"
                            ? <AIMessage text={m.text} error={m.error} />
                            : <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
                                style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>{m.text}</div>
                          }
                          <span className="text-[10px] text-slate-400 px-1">{m.time}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {loading && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#f5f3ff" }}>
                        <Loader2 size={11} className="text-purple-600 animate-spin" />
                      </div>
                      <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div className="flex gap-1 items-center h-4">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="px-4 py-3 shrink-0 border-t border-slate-50">
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !loading && send()}
                      placeholder="Ask about fraud patterns…"
                      className="flex-1 text-sm text-slate-700 bg-transparent outline-none placeholder:text-slate-400" />
                    <button onClick={() => send()} disabled={!input.trim() || loading}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 shrink-0"
                      style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                      <Send size={12} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[10px] text-slate-400">Requires FastAPI · GROQ_API_KEY</p>
                    <button onClick={() => setChatMessages([{ role: "ai", text: "Chat cleared. How can I help?", time: ts() }])}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                      <RotateCcw size={9} /> Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default AICopilot;
