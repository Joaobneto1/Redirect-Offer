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
        title="Novo produto"
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
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          {list.map((p) => (
            <motion.div key={p.id} variants={item}>
              <Link to={`/campaigns/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <motion.div
                  className="card"
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  style={{ padding: "var(--space-5) var(--space-6)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600 }}>
                        {p.name}
                      </h3>
                      <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                        {p._count.endpoints} endpoint{p._count.endpoints !== 1 ? "s" : ""} · {p._count.links} link{p._count.links !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>→</span>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
}
