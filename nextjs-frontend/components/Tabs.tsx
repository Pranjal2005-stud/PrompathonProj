"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { motion } from "framer-motion";

interface TabsContextType {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = createContext<TabsContextType>({ value: "", setValue: () => {} });

export function Tabs({ children, defaultValue = "", className = "" }: { children: ReactNode; defaultValue?: string; className?: string }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsContext.Provider value={{ value: value || defaultValue, setValue }}><div className={className}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit" style={{ border: "1px solid #e2e8f0" }}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { value: activeValue, setValue } = useContext(TabsContext);
  const isActive = activeValue === value;
  return (
    <button
      onClick={() => setValue(value)}
      className="relative px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200"
      style={{ color: isActive ? "#2563eb" : "#64748b" }}
    >
      {isActive && (
        <motion.div
          layoutId="tabIndicator"
          className="absolute inset-0 bg-white rounded-lg"
          style={{ boxShadow: "0 2px 8px rgba(37,99,235,0.15)" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const { value: activeValue } = useContext(TabsContext);
  if (activeValue !== value) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-4"
    >
      {children}
    </motion.div>
  );
}