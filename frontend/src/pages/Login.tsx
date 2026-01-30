import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Login() {
  const { user, loading, login } = useAuth();
  if (loading) return <div className="auth-loading"><p>Carregando…</p></div>;
  if (user) return <Navigate to="/" replace />;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Entrar</h1>
        <p className="auth-desc">Acesse o dashboard de links inteligentes.</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              autoFocus
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="auth-error">{error}</p>
          )}
          <button
            type="submit"
            className="btn btn--primary auth-submit"
            disabled={submitting}
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="auth-footer">
          Solicite seu acesso ao administrador.
        </p>
        <p className="auth-footer">
          <a href="/superadmin">É admin?</a>
        </p>
      </div>
    </div>
  );
}
