import { useState, useEffect } from "react";
import { motion } from "framer-motion";

type User = {
  id: string;
  email: string;
  name: string | null;
  passwordText: string | null;
  role: "SUPERADMIN" | "USER";
  isActive: boolean;
  createdAt: string;
};

const BASE_URL = "";

export function SuperAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal de criar/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"SUPERADMIN" | "USER">("USER");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Visibilidade das senhas
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const fetchUsers = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/superadmin/users`, {
        headers: { "x-superadmin-auth": authToken },
      });
      if (!res.ok) throw new Error("Erro ao carregar");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && authToken) {
      fetchUsers();
    }
  }, [isAuthenticated, authToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const res = await fetch(`${BASE_URL}/api/superadmin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || "Erro ao entrar");
        return;
      }

      setAuthToken(data.token);
      setIsAuthenticated(true);
    } catch {
      setLoginError("Erro de conexão");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthToken(null);
    setUsers([]);
    setLoginEmail("");
    setLoginPassword("");
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormEmail("");
    setFormName("");
    setFormPassword("");
    setFormRole("USER");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormName(user.name || "");
    setFormPassword("");
    setFormRole(user.role);
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      if (editingUser) {
        // Atualizar
        const body: { name?: string; password?: string; role?: string } = {};
        if (formName !== (editingUser.name || "")) body.name = formName;
        if (formPassword) body.password = formPassword;
        if (formRole !== editingUser.role) body.role = formRole;

        const res = await fetch(`${BASE_URL}/api/superadmin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-superadmin-auth": authToken!,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao atualizar");
        }
      } else {
        // Criar
        const res = await fetch(`${BASE_URL}/api/superadmin/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-superadmin-auth": authToken!,
          },
          body: JSON.stringify({
            email: formEmail.trim(),
            password: formPassword,
            name: formName.trim() || undefined,
            role: formRole,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao criar");
        }
      }

      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`${BASE_URL}/api/superadmin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-superadmin-auth": authToken!,
        },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!res.ok) throw new Error("Erro ao alterar");
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Excluir "${user.email}"?`)) return;

    try {
      const res = await fetch(`${BASE_URL}/api/superadmin/users/${user.id}`, {
        method: "DELETE",
        headers: { "x-superadmin-auth": authToken! },
      });

      if (!res.ok) throw new Error("Erro ao excluir");
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  // Tela de login
  if (!isAuthenticated) {
    return (
      <div className="superadmin-login-container">
        <motion.div
          className="superadmin-login-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>Super Admin</h1>
          <p>Acesso restrito</p>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="seu@email.com"
                autoFocus
              />
            </div>

            <div className="input-group">
              <label htmlFor="login-password">Senha</label>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showLoginPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="error-text">{loginError}</p>
            )}

            <button type="submit" className="btn btn--primary btn--full">
              Entrar
            </button>
          </form>

          <div className="superadmin-footer">
            <a href="/login" className="superadmin-link">Ir para login</a>
          </div>
        </motion.div>
      </div>
    );
  }

  // Painel principal
  return (
    <div className="superadmin-container">
      <header className="superadmin-header">
        <h1>Super Admin</h1>
        <div className="superadmin-header-actions">
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Novo usuário
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{editingUser ? "Editar usuário" : "Novo usuário"}</h2>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="form-email">E-mail</label>
                <input
                  id="form-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  disabled={!!editingUser}
                  autoFocus={!editingUser}
                />
              </div>

              <div className="input-group">
                <label htmlFor="form-name">Nome (opcional)</label>
                <input
                  id="form-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do usuário"
                />
              </div>

              <div className="input-group">
                <label htmlFor="form-password">
                  {editingUser ? "Nova senha (deixe vazio para manter)" : "Senha"}
                </label>
                <input
                  id="form-password"
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus={!!editingUser}
                />
              </div>

              <div className="input-group">
                <label htmlFor="form-role">Tipo de usuário</label>
                <select
                  id="form-role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as "SUPERADMIN" | "USER")}
                  className="form-select"
                >
                  <option value="USER">Usuário comum</option>
                  <option value="SUPERADMIN">Super Admin</option>
                </select>
              </div>

              {formError && <p className="error-text">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting || (!editingUser && (!formEmail.trim() || !formPassword))}
                >
                  {submitting ? "Salvando…" : editingUser ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Lista de usuários */}
      {loading ? (
        <p className="loading-text">Carregando…</p>
      ) : users.length === 0 ? (
        <div className="empty-state-card">
          <h3>Nenhum usuário cadastrado</h3>
          <p>Crie o primeiro usuário para acessar o dashboard.</p>
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Novo usuário
          </button>
        </div>
      ) : (
        <div className="users-list">
          {users.map((u) => (
            <motion.div
              key={u.id}
              className="user-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="user-card-main">
                <div className="user-card-info">
                  <div className="user-card-header">
                    <span className="user-email">{u.email}</span>
                    <span className={`role-badge ${u.role === "SUPERADMIN" ? "superadmin" : "user"}`}>
                      {u.role === "SUPERADMIN" ? "Super Admin" : "Usuário"}
                    </span>
                    <span className={`status-badge ${u.isActive ? "active" : "inactive"}`}>
                      {u.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  {u.name && <p className="user-name">{u.name}</p>}

                  <div className="user-password-row">
                    <span className="password-label">Senha:</span>
                    <span className="password-value">
                      {visiblePasswords.has(u.id) ? u.passwordText || "—" : "••••••••"}
                    </span>
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => togglePasswordVisibility(u.id)}
                      aria-label={visiblePasswords.has(u.id) ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {visiblePasswords.has(u.id) ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <p className="user-date">
                    Criado em {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div className="user-card-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(u)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className={`btn btn--ghost btn--sm ${u.isActive ? "btn--warning" : "btn--success"}`}
                    onClick={() => handleToggleActive(u)}
                  >
                    {u.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={() => handleDelete(u)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
