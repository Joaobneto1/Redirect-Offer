import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";

type SmartLink = {
  id: string;
  slug: string;
  campaignId: string;
  fallbackUrl: string | null;
  campaign: { id: string; name: string };
};

type Campaign = {
  id: string;
  name: string;
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

export function Links() {
  const [links, setLinks] = useState<SmartLink[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<SmartLink | null>(null);
  const [slug, setSlug] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Validação de slug
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const fetchData = () => {
    Promise.all([api.smartLinks.list(), api.campaigns.list()])
      .then(([l, c]) => {
        setLinks(l);
        setCampaigns(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (editing) {
      setSlug(editing.slug);
      setCampaignId(editing.campaignId);
      setFallbackUrl(editing.fallbackUrl ?? "");
      setSlugAvailable(null);
      setSlugSuggestions([]);
    } else if (!modal) {
      setSlug("");
      setCampaignId(campaigns[0]?.id ?? "");
      setFallbackUrl("");
      setSlugAvailable(null);
      setSlugSuggestions([]);
    }
  }, [editing, modal, campaigns]);

  // Verificar disponibilidade do slug com debounce
  const checkSlugAvailability = useCallback(async (slugValue: string) => {
    const normalizedSlug = slugValue.trim().toLowerCase().replace(/\s+/g, "-");
    if (!normalizedSlug || normalizedSlug.length < 2) {
      setSlugAvailable(null);
      setSlugSuggestions([]);
      return;
    }

    setCheckingSlug(true);
    try {
      const result = await api.smartLinks.checkSlug(normalizedSlug);
      setSlugAvailable(result.available);
      setSlugSuggestions(result.suggestions ?? []);
    } catch {
      setSlugAvailable(null);
      setSlugSuggestions([]);
    } finally {
      setCheckingSlug(false);
    }
  }, []);

  // Debounce para verificação de slug
  useEffect(() => {
    if (editing) return; // Não verificar ao editar

    const timer = setTimeout(() => {
      if (slug.trim()) {
        checkSlugAvailability(slug);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, editing, checkSlugAvailability]);

  const openCreate = () => {
    setEditing(null);
    setSlug("");
    setCampaignId(campaigns[0]?.id ?? "");
    setFallbackUrl("");
    setError(null);
    setSlugAvailable(null);
    setSlugSuggestions([]);
    setModal(true);
  };

  const openEdit = (link: SmartLink) => {
    setEditing(link);
    setModal(true);
    setError(null);
  };

  const closeModal = () => {
    setModal(false);
    setEditing(null);
    setError(null);
    setSlugAvailable(null);
    setSlugSuggestions([]);
  };

  const useSuggestion = (suggestion: string) => {
    setSlug(suggestion);
    setSlugAvailable(true);
    setSlugSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
        fallbackUrl: fallbackUrl.trim() || null,
      };
      if (editing) {
        await api.smartLinks.update(editing.id, payload);
      } else {
        if (!campaignId) throw new Error("Selecione uma campanha");
        await api.smartLinks.create({
          ...payload,
          campaignId: campaignId,
        });
      }
      closeModal();
      fetchData();
    } catch (err: any) {
      // Tratar erro de slug duplicado
      if (err?.message?.includes("slug já está em uso")) {
        setSlugAvailable(false);
        setError(err.message);
        // Buscar sugestões atualizadas
        checkSlugAvailability(slug);
      } else {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (link: SmartLink) => {
    if (!confirm(`Remover o link /go/${link.slug}?`)) return;
    try {
      await api.smartLinks.delete(link.id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const goBase = typeof window !== "undefined" ? `${window.location.origin}/go` : "/go";

  const copyUrl = (slug: string) => {
    const url = `${goBase}/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <>
      <PageHeader
        title="Links inteligentes"
        desc="Gerencie slugs para campanhas. Use /go/:slug para redirecionar."
        action={
          <button
            type="button"
            className="btn btn--primary"
            onClick={openCreate}
            disabled={campaigns.length === 0}
          >
            Novo link
          </button>
        }
      />

      <Modal
        open={modal}
        onClose={closeModal}
        title={editing ? "Editar link" : "Novo link inteligente"}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button
              type="submit"
              form="form-link"
              className="btn btn--primary"
              disabled={submitting || !slug.trim() || (!editing && !campaignId) || (!editing && slugAvailable === false)}
            >
              {submitting ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </button>
          </>
        }
      >
        <form id="form-link" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="link-slug">Slug</label>
            <div className="slug-input-wrapper">
              <input
                id="link-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="black-friday"
                autoFocus
                disabled={!!editing}
                className={!editing && slugAvailable !== null ? (slugAvailable ? "input--valid" : "input--invalid") : ""}
              />
              {!editing && checkingSlug && (
                <span className="slug-status checking">Verificando...</span>
              )}
              {!editing && !checkingSlug && slugAvailable === true && (
                <span className="slug-status available">✓ Disponível</span>
              )}
              {!editing && !checkingSlug && slugAvailable === false && (
                <span className="slug-status unavailable">✗ Em uso</span>
              )}
            </div>
            {editing && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                Slug não pode ser alterado.
              </p>
            )}
            {/* Sugestões de slugs */}
            {!editing && slugAvailable === false && slugSuggestions.length > 0 && (
              <div className="slug-suggestions">
                <p className="slug-suggestions-label">Sugestões disponíveis:</p>
                <div className="slug-suggestions-list">
                  {slugSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="btn btn--ghost slug-suggestion-btn"
                      onClick={() => useSuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {!editing && (
            <div className="input-group">
              <label htmlFor="link-campaign">Campanha</label>
              <select
                id="link-campaign"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">Selecione uma campanha</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="input-group">
            <label htmlFor="link-fallback">Fallback URL (opcional)</label>
            <input
              id="link-fallback"
              type="url"
              value={fallbackUrl}
              onChange={(e) => setFallbackUrl(e.target.value)}
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

      {loading ? (
        <p className="page-desc">Carregando…</p>
      ) : links.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ padding: "var(--space-12)" }}
        >
          <div className="empty-state">
            <h3>Nenhum link</h3>
            <p>
              {campaigns.length === 0
                ? "Crie uma campanha antes de adicionar links."
                : "Crie um link para usar em campanhas (/go/:slug)."}
            </p>
            {campaigns.length > 0 && (
              <button type="button" className="btn btn--primary" onClick={openCreate}>
                Novo link
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div className="card">
          {/* Desktop: Tabela */}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>URL</th>
                  <th>Campanha</th>
                  <th>Fallback</th>
                  <th></th>
                </tr>
              </thead>
              <motion.tbody
                variants={container}
                initial="hidden"
                animate="show"
                style={{ display: "table-row-group" }}
              >
                {links.map((l) => (
                  <motion.tr key={l.id} variants={item}>
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
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ marginLeft: "var(--space-2)", fontSize: "0.8rem" }}
                        onClick={() => copyUrl(l.slug)}
                      >
                        {copied === l.slug ? "Copiado" : "Copiar"}
                      </button>
                    </td>
                    <td>{l.campaign.name}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      {l.fallbackUrl || "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ fontSize: "0.85rem", marginRight: "var(--space-2)" }}
                        onClick={() => openEdit(l)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ color: "var(--danger)", fontSize: "0.85rem" }}
                        onClick={() => handleDelete(l)}
                      >
                        Excluir
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>

          {/* Mobile: Cards */}
          <motion.div
            className="links-mobile-list"
            variants={container}
            initial="hidden"
            animate="show"
            style={{ padding: "var(--space-4)" }}
          >
            {links.map((l) => (
              <motion.div key={l.id} className="link-card-mobile" variants={item}>
                <div className="link-card-mobile-row">
                  <span className="link-card-mobile-label">Slug</span>
                  <span className="link-card-mobile-value mono">{l.slug}</span>
                </div>
                <div className="link-card-mobile-row">
                  <span className="link-card-mobile-label">URL</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <a
                      href={`${goBase}/${l.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-url"
                    >
                      /go/{l.slug}
                    </a>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)", minHeight: "auto" }}
                      onClick={() => copyUrl(l.slug)}
                    >
                      {copied === l.slug ? "✓" : "Copiar"}
                    </button>
                  </div>
                </div>
                <div className="link-card-mobile-row">
                  <span className="link-card-mobile-label">Campanha</span>
                  <span className="link-card-mobile-value">{l.campaign.name}</span>
                </div>
                {l.fallbackUrl && (
                  <div className="link-card-mobile-row">
                    <span className="link-card-mobile-label">Fallback</span>
                    <span className="link-card-mobile-value" style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      {l.fallbackUrl}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--border-subtle)" }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ flex: 1, fontSize: "0.85rem" }}
                    onClick={() => openEdit(l)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ flex: 1, color: "var(--danger)", fontSize: "0.85rem" }}
                    onClick={() => handleDelete(l)}
                  >
                    Excluir
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
