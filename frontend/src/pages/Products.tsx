import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastProvider";

type Campaign = {
  id: string;
  name: string;
  createdAt: string;
  _count: { endpoints: number; links: number };
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

export function Products() {
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const fetchProducts = () => {
    api.campaigns.list().then(setList).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.campaigns.create({ name: name.trim() });
      setName("");
      setModal(false);
      fetchProducts();
      toast.show("Campanha criada", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar";
      setError(msg);
      toast.show(`Erro: ${msg}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (campaign: Campaign, e: React.MouseEvent) => {
    e.preventDefault(); // Não navegar para a campanha
    e.stopPropagation();
    
    const hasContent = campaign._count.endpoints > 0 || campaign._count.links > 0;
    const confirmMsg = hasContent
      ? `Excluir "${campaign.name}"?\n\nIsso também excluirá:\n- ${campaign._count.endpoints} endpoint(s)\n- ${campaign._count.links} link(s)`
      : `Excluir "${campaign.name}"?`;
    
    if (!confirm(confirmMsg)) return;

    try {
      await api.campaigns.delete(campaign.id);
      toast.show("Campanha excluída", "success");
      fetchProducts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir";
      toast.show(`Erro: ${msg}`, "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Campanhas"
        desc="Gerencie campanhas e seus endpoints de checkout."
        action={
          <button type="button" className="btn btn--primary" onClick={() => setModal(true)}>
            Nova campanha
          </button>
        }
      />

      <Modal
        open={modal}
        onClose={() => { setModal(false); setError(null); setName(""); }}
        title="Nova campanha"
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setModal(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-product"
              className="btn btn--primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? "Criando…" : "Criar"}
            </button>
          </>
        }
      >
        <form id="form-product" onSubmit={handleCreate}>
          <div className="input-group">
            <label htmlFor="product-name">Nome</label>
            <input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Black Friday 2026"
              autoFocus
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
      ) : list.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ padding: "var(--space-16)" }}
        >
          <div className="empty-state">
            <h3>Nenhuma campanha</h3>
            <p>Crie uma campanha para organizar endpoints e links inteligentes.</p>
            <button type="button" className="btn btn--primary" onClick={() => setModal(true)}>
              Nova campanha
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          {list.map((p) => (
            <motion.div key={p.id} variants={item}>
              <motion.div
                className="card campaign-card"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <Link 
                  to={`/campaigns/${p.id}`} 
                  className="campaign-card-link"
                >
                  <div className="campaign-card-info">
                    <h3 className="campaign-card-title">{p.name}</h3>
                    <p className="campaign-card-meta">
                      {p._count.endpoints} endpoint{p._count.endpoints !== 1 ? "s" : ""} · {p._count.links} link{p._count.links !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="campaign-card-arrow">→</span>
                </Link>
                <button
                  type="button"
                  className="btn btn--ghost btn--danger-text campaign-delete-btn"
                  onClick={(e) => handleDelete(p, e)}
                  title="Excluir campanha"
                >
                  Excluir
                </button>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
}
