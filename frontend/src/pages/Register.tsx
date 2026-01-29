import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Register() {
  const { user, loading, register } = useAuth();
  if (loading) return <div className="auth-loading"><p>Carregando…</p></div>;
  if (user) return <Navigate to="/" replace />;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Cadastro</h1>
        <p className="auth-desc">Crie sua conta para gerenciar links inteligentes.</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="register-name">Nome (opcional)</label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
            />
          </div>
          <div className="input-group">
            <label htmlFor="register-email">E-mail</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="register-password">Senha (mín. 6 caracteres)</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
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
            {submitting ? "Cadastrando…" : "Cadastrar"}
          </button>
        </form>
        <p className="auth-footer">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
