import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";

type SmartLink = {
  id: string;
  slug: string;
  groupId: string;
  fallbackUrl: string | null;
  group: {
    id: string;
    name: string;
    product: { id: string; name: string };
  };
};

type Group = {
  id: string;
  name: string;
  product: { id: string; name: string };
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<SmartLink | null>(null);
  const [slug, setSlug] = useState("");
  const [groupId, setGroupId] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = () => {
    Promise.all([api.smartLinks.list(), api.groups.list()])
      .then(([l, g]) => {
        setLinks(l);
        setGroups(g);
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
      setGroupId(editing.groupId);
      setFallbackUrl(editing.fallbackUrl ?? "");
    } else if (!modal) {
      setSlug("");
      setGroupId(groups[0]?.id ?? "");
      setFallbackUrl("");
    }
  }, [editing, modal, groups]);

  const openCreate = () => {
    setEditing(null);
    setSlug("");
    setGroupId(groups[0]?.id ?? "");
    setFallbackUrl("");
    setError(null);
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
        if (!groupId) throw new Error("Selecione um grupo");
        await api.smartLinks.create({
          ...payload,
          groupId,
        });
      }
      closeModal();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
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
            disabled={groups.length === 0}
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
              disabled={submitting || !slug.trim() || (!editing && !groupId)}
            >
              {submitting ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </button>
          </>
        }
      >
        <form id="form-link" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="link-slug">Slug</label>
            <input
              id="link-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="black-friday"
              autoFocus
              disabled={!!editing}
            />
            {editing && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                Slug não pode ser alterado.
              </p>
            )}
          </div>
          {!editing && (
            <div className="input-group">
              <label htmlFor="link-group">Grupo</label>
              <select
                id="link-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">Selecione um grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.product.name} → {g.name}
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
          style={{ padding: "var(--space-16)" }}
        >
          <div className="empty-state">
            <h3>Nenhum link</h3>
            <p>
              {groups.length === 0
                ? "Crie um produto e um grupo de checkout antes de adicionar links."
                : "Crie um link para usar em campanhas (/go/:slug)."}
            </p>
            {groups.length > 0 && (
              <button type="button" className="btn btn--primary" onClick={openCreate}>
                Novo link
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>URL</th>
                  <th>Grupo</th>
                  <th>Produto</th>
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
                  <motion.tr
                    key={l.id}
                    variants={item}
                  >
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
                    <td>{l.group.name}</td>
                    <td>{l.group.product.name}</td>
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
        </motion.div>
      )}
    </>
  );
}
