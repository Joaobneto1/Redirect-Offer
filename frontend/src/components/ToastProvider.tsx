import React, { createContext, useContext, useState, useCallback } from "react";

type Toast = { id: string; message: string; type?: "info" | "success" | "error"; timeout?: number };

const ToastContext = createContext<{ show: (msg: string, type?: Toast["type"], timeout?: number) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast["type"] = "info", timeout = 4000) => {
    const id = Math.random().toString(36).slice(2, 9);
    const t: Toast = { id, message, type, timeout };
    setToasts((s) => [...s, t]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), timeout);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 2000 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            marginBottom: 10,
            minWidth: 220,
            background: t.type === "error" ? "rgba(220,50,50,0.95)" : t.type === "success" ? "rgba(34,197,94,0.95)" : "rgba(60,60,60,0.95)",
            color: "white",
            padding: "10px 14px",
            borderRadius: 10,
            boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
            fontSize: 14
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

