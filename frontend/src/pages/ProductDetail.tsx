import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";

type ProductDetail = {
  id: string;
  name: string;
  groups: Array<{
    id: string;
    name: string;
    rotationStrategy: string;
    _count: { checkouts: number; smartLinks: number };
  }>;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [strategy, setStrategy] = useState<"round-robin" | "priority">("round-robin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = () => {
    if (!id) return;
    api.products
      .get(id)
      .then(setProduct)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.groups.create({
        productId: id,
        name: groupName.trim(),
        rotationStrategy: strategy,
      });
      setGroupName("");
      setModal(false);
      fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar grupo");
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) return null;
  if (loading || !product) {
    return <p className="page-desc">Carregando…</p>;
  }

  return (
    <>
      <Link
        to="/products"
        className="btn btn--ghost"
        style={{ marginBottom: "var(--space-4)", alignSelf: "flex-start" }}
      >
        ← Produtos
      </Link>
      <PageHeader
        title={product.name}
        desc="Grupos de checkout e rotação."
        action={
          <button type="button" className="btn btn--primary" onClick={() => setModal(true)}>
            Novo grupo
          </button>
        }
      />

      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
          setError(null);
          setGroupName("");
        }}
        title="Novo grupo de checkout"
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
              form="form-group"
              className="btn btn--primary"
              disabled={submitting || !groupName.trim()}
            >
              {submitting ? "Criando…" : "Criar"}
            </button>
          </>
        }
      >
        <form id="form-group" onSubmit={handleCreateGroup}>
          <div className="input-group">
            <label htmlFor="group-name">Nome</label>
            <input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ex.: Checkout principal"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label htmlFor="group-strategy">Rotação</label>
            <select
              id="group-strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as "round-robin" | "priority")}
            >
              <option value="round-robin">Round-robin (menos usado primeiro)</option>
              <option value="priority">Prioridade (maior primeiro)</option>
            </select>
          </div>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: "0.9rem", marginTop: "var(--space-2)" }}>
              {error}
            </p>
          )}
        </form>
      </Modal>

      {product.groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ padding: "var(--space-16)" }}
        >
          <div className="empty-state">
            <h3>Nenhum grupo</h3>
            <p>Adicione um grupo para definir checkouts e links inteligentes.</p>
            <button type="button" className="btn btn--primary" onClick={() => setModal(true)}>
              Novo grupo
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
          {product.groups.map((g) => (
            <motion.div key={g.id} variants={item}>
              <Link
                to={`/groups/${g.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <motion.div
                  className="card"
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  style={{ padding: "var(--space-5) var(--space-6)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600 }}>
                        {g.name}
                      </h3>
                      <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                        {g._count.checkouts} checkout{g._count.checkouts !== 1 ? "s" : ""} · {g._count.smartLinks} link{g._count.smartLinks !== 1 ? "s" : ""} ·{" "}
                        <span className="mono" style={{ fontSize: "0.85rem" }}>
                          {g.rotationStrategy}
                        </span>
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
