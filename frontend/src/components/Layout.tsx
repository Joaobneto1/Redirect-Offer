import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

const nav = [
  { path: "/", label: "Visão geral" },
  { path: "/products", label: "Produtos" },
  { path: "/links", label: "Links inteligentes" },
] as const;

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const loc = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="layout">
      <div className="grain" aria-hidden />
      <button
        type="button"
        className="menu-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        )}
      </button>
      <div
        className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={closeSidebar}
        onKeyDown={(e) => e.key === "Escape" && closeSidebar()}
        role="button"
        tabIndex={-1}
        aria-hidden
      />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <Link to="/" className="logo" onClick={closeSidebar}>
          <span className="logo-icon" />
          <span className="logo-text">Redirect</span>
        </Link>
        <nav className="nav">
          {nav.map((item, i) => {
            const active = loc.pathname === item.path || (item.path !== "/" && loc.pathname.startsWith(item.path + "/"));
            return (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={item.path}
                  className={`nav-link ${active ? "nav-link--active" : ""}`}
                  onClick={closeSidebar}
                >
                  {item.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <span className="sidebar-user-email" title={user.email}>
                {user.name || user.email}
              </span>
              <button type="button" className="btn btn--ghost sidebar-logout" onClick={logout}>
                Sair
              </button>
            </div>
          )}
          <a
            href="/health"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-health"
            onClick={closeSidebar}
          >
            <span className="live-dot" /> API
          </a>
        </div>
      </aside>
      <main className="main bg-grid">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}
