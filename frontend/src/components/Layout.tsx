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

  return (
    <div className="layout">
      <div className="grain" aria-hidden />
      <aside className="sidebar">
        <Link to="/" className="logo">
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
