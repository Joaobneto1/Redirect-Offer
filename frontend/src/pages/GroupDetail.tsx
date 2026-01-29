import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";

type GroupDetail = {
  id: string;
  productId: string;
  name: string;
  rotationStrategy: string;
  product: { id: string; name: string };
  checkouts: Array<{
    id: string;
    url: string;
    priority: number;
    isActive: boolean;
    lastError: string | null;
    lastCheckedAt: string | null;
    lastUsedAt: string | null;
    consecutiveFailures: number;
  }>;
  smartLinks: Array<{ id: string; slug: string; fallbackUrl: string | null }>;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [linkModal, setLinkModal] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutPriority, setCheckoutPriority] = useState(0);
  const [linkSlug, setLinkSlug] = useState("");
  const [linkFallback, setLinkFallback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const fetchGroup = () => {
    if (!id) return;
    api.groups
      .get(id)
      .then(setGroup)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const handleAddCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.checkouts.create({
        groupId: id,
        url: checkoutUrl.trim(),
        priority: checkoutPriority,
      });
      setCheckoutUrl("");
      setCheckoutPriority(0);
      setCheckoutModal(false);
      fetchGroup();
    } catch (err) {
      setError(err instanceof Error ? err.message : "URL inválida ou erro ao criar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.smartLinks.create({
        groupId: id,
        slug: linkSlug.trim().toLowerCase().replace(/\s+/g, "-"),
        fallbackUrl: linkFallback.trim() || null,
      });
      setLinkSlug("");
      setLinkFallback("");
      setLinkModal(false);
      fetchGroup();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Slug em uso ou inválido");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCheckoutActive = async (checkoutId: string, isActive: boolean) => {
    try {
      await api.checkouts.update(checkoutId, { isActive: !isActive });
      fetchGroup();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCheckout = async (checkoutId: string) => {
    if (!confirm("Remover este checkout?")) return;
    try {
      await api.checkouts.delete(checkoutId);
      fetchGroup();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteLink = async (linkId: string) => {
    if (!confirm("Remover este link?")) return;
    try {
      await api.smartLinks.delete(linkId);
      fetchGroup();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheck = async (checkoutId: string) => {
    setCheckingId(checkoutId);
    try {
      await api.checkouts.check(checkoutId);
      fetchGroup();
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingId(null);
    }
  };

  if (!id) return null;
  if (loading || !group) {
    return <p className="page-desc">Carregando…</p>;
  }

  const goBase = typeof window !== "undefined" ? `${window.location.origin}/go` : "/go";

  return (
    <>
      <Link
        to={`/products/${group.productId}`}
        className="btn btn--ghost"
        style={{ marginBottom: "var(--space-4)", alignSelf: "flex-start" }}
      >
        ← {group.product.name}
      </Link>
      <PageHeader
        title={group.name}
        desc={`Rotação: ${group.rotationStrategy}`}
        action={
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => { setCheckoutModal(true); setLinkModal(false); setError(null); }}
            >
              + Checkout
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => { setLinkModal(true); setCheckoutModal(false); setError(null); }}
            >
              + Link inteligente
            </button>
          </div>
        }
      />

      <Modal
        open={checkoutModal}
        onClose={() => {
          setCheckoutModal(false);
          setError(null);
          setCheckoutUrl("");
          setCheckoutPriority(0);
        }}
        title="Novo checkout"
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setCheckoutModal(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-checkout"
              className="btn btn--primary"
              disabled={submitting || !checkoutUrl.trim()}
            >
              {submitting ? "Criando…" : "Criar"}
            </button>
          </>
        }
      >
        <form id="form-checkout" onSubmit={handleAddCheckout}>
          <div className="input-group">
            <label htmlFor="checkout-url">URL</label>
            <input
              id="checkout-url"
              type="url"
              value={checkoutUrl}
              onChange={(e) => setCheckoutUrl(e.target.value)}
              placeholder="https://…"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label htmlFor="checkout-priority">Prioridade (maior = preferido)</label>
            <input
              id="checkout-priority"
              type="number"
              value={checkoutPriority}
              onChange={(e) => setCheckoutPriority(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: "0.9rem", marginTop: "var(--space-2)" }}>
              {error}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={linkModal}
        onClose={() => {
          setLinkModal(false);
          setError(null);
          setLinkSlug("");
          setLinkFallback("");
        }}
        title="Novo link inteligente"
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setLinkModal(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-link"
              className="btn btn--primary"
              disabled={submitting || !linkSlug.trim()}
            >
              {submitting ? "Criando…" : "Criar"}
            </button>
          </>
        }
      >
        <form id="form-link" onSubmit={handleAddLink}>
          <div className="input-group">
            <label htmlFor="link-slug">Slug (apenas letras, números, _ e -)</label>
            <input
              id="link-slug"
              value={linkSlug}
              onChange={(e) => setLinkSlug(e.target.value)}
              placeholder="black-friday"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label htmlFor="link-fallback">Fallback URL (opcional)</label>
            <input
              id="link-fallback"
              type="url"
              value={linkFallback}
              onChange={(e) => setLinkFallback(e.target.value)}
              placeholder="https://…"
            />
          </div>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: "0.9rem", marginTop: "var(--space-2)" }}>
              {error}
            </p>
          )}
        </form>
      </Modal>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
      >
        <motion.section variants={item}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Checkouts</h2>
            </div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {group.checkouts.length === 0 ? (
                <p className="page-desc" style={{ margin: 0 }}>
                  Nenhum checkout. Adicione URLs para redirecionar tráfego.
                </p>
              ) : (
                <>
                  <p className="page-desc" style={{ margin: "0 0 var(--space-4)" }}>
                    Clique em <strong>Verificar</strong> para testar se a URL está ativa. O sistema analisa URL final e HTML (Hotmart, Eduzz, etc.) e detecta oferta inativa. Falhas aparecem em <strong>Erro</strong>; após várias falhas o checkout pode ficar <strong>Inativo</strong>.
                  </p>
                  <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>URL</th>
                        <th>Prioridade</th>
                        <th>Status</th>
                        <th>Última verificação</th>
                        <th>Último uso</th>
                        <th>Erro</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.checkouts.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-url mono"
                            >
                              {c.url.length > 50 ? `${c.url.slice(0, 50)}…` : c.url}
                            </a>
                          </td>
                          <td>{c.priority}</td>
                          <td>
                            <span
                              className={`badge ${c.isActive ? "badge--live" : "badge--off"}`}
                            >
                              {c.isActive ? "Ativo" : "Inativo"}
                            </span>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ marginLeft: "var(--space-2)", fontSize: "0.8rem" }}
                              onClick={() => toggleCheckoutActive(c.id, c.isActive)}
                            >
                              {c.isActive ? "Desativar" : "Reativar"}
                            </button>
                          </td>
                          <td style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                            {c.lastCheckedAt
                              ? new Date(c.lastCheckedAt).toLocaleString("pt-BR")
                              : "—"}
                          </td>
                          <td style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                            {c.lastUsedAt
                              ? new Date(c.lastUsedAt).toLocaleString("pt-BR")
                              : "—"}
                          </td>
                          <td
                            style={{
                              fontSize: "0.85rem",
                              maxWidth: 200,
                              color: c.lastError ? "var(--danger)" : "var(--text-muted)",
                              fontWeight: c.lastError ? 500 : undefined,
                            }}
                            title={c.lastError ?? undefined}
                          >
                            {c.lastError ? (
                              <span>
                                {c.lastError.length > 32
                                  ? `${c.lastError.slice(0, 32)}…`
                                  : c.lastError}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ marginRight: "var(--space-2)", fontSize: "0.85rem" }}
                              onClick={() => handleCheck(c.id)}
                              disabled={checkingId !== null}
                            >
                              {checkingId === c.id ? "Verificando…" : "Verificar"}
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ color: "var(--danger)", fontSize: "0.85rem" }}
                              onClick={() => deleteCheckout(c.id)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </div>
        </motion.section>

        <motion.section variants={item}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Links inteligentes</h2>
            </div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {group.smartLinks.length === 0 ? (
                <p className="page-desc" style={{ margin: 0 }}>
                  Nenhum link. Crie um para usar em campanhas (/go/:slug).
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Slug</th>
                        <th>URL</th>
                        <th>Fallback</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.smartLinks.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <span className="mono">{l.slug}</span>
                          </td>
                          <td>
                            <a
                              href={`${goBase}/${l.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-url"
                            >
                              /go/{l.slug}
                            </a>
                          </td>
                          <td style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                            {l.fallbackUrl || "—"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ color: "var(--danger)", fontSize: "0.85rem" }}
                              onClick={() => deleteLink(l.id)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </motion.div>
    </>
  );
}
