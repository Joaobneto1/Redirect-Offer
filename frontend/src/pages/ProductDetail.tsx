import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/ToastProvider";
import { Modal } from "../components/Modal";

type ProductDetail = {
  id: string;
  name: string;
  endpoints: Array<{
    id: string;
    url: string;
    priority: number;
    isActive: boolean;
  }>;
  links: Array<{ id: string; slug: string; fallbackUrl: string | null }>;
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
  const [endpointUrl, setEndpointUrl] = useState("");
  const [endpointPriority, setEndpointPriority] = useState(0);
  const [autoCheckEnabledState, setAutoCheckEnabledState] = useState<boolean>(false);
  const [autoCheckIntervalState, setAutoCheckIntervalState] = useState<number>(60);
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editEndpoint, setEditEndpoint] = useState<{ id: string; url: string; priority: number } | null>(null);
  const [settingsModal, setSettingsModal] = useState(false);

  const fetchProduct = () => {
    if (!id) return;
    api.campaigns
      .get(id)
      .then((res) => {
        setProduct(res);
        setAutoCheckEnabledState(res.autoCheckEnabled ?? false);
        setAutoCheckIntervalState(res.autoCheckInterval ?? 60);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.endpoints.create({
        campaignId: id,
        url: endpointUrl.trim(),
        priority: endpointPriority,
      });
      setEndpointUrl("");
      setEndpointPriority(0);
      setModal(false);
      fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar endpoint");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.campaigns.update(id!, { autoCheckEnabled: autoCheckEnabledState, autoCheckInterval: autoCheckIntervalState });
      toast.show("Configurações salvas", "success");
      setSettingsModal(false);
      fetchProduct();
    } catch (err) {
      toast.show("Erro ao salvar", "error");
      console.error(err);
    }
  };

  if (!id) return null;
  if (loading || !product) {
    return <p className="page-desc">Carregando…</p>;
  }

  return (
    <>
      <Link
        to="/campaigns"
        className="btn btn--ghost"
        style={{ marginBottom: "var(--space-4)", alignSelf: "flex-start" }}
      >
        ← Campanhas
      </Link>
      <PageHeader
        title={product.name}
        desc="Endpoints de checkout e links associados."
        action={
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setSettingsModal(true)}
            >
              Configurações
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setModal(true)}>
              Novo endpoint
            </button>
          </div>
        }
      />

      {/* Modal de Configurações */}
      <Modal
        open={settingsModal}
        onClose={() => setSettingsModal(false)}
        title="Configurações da campanha"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setSettingsModal(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSaveSettings}>
              Salvar
            </button>
          </>
        }
      >
        <div className="input-group">
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoCheckEnabledState}
              onChange={(e) => setAutoCheckEnabledState(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span>Habilitar verificação automática</span>
          </label>
        </div>
        <div className="input-group">
          <label htmlFor="auto-interval">Intervalo de verificação (segundos)</label>
          <input
            id="auto-interval"
            type="number"
            min={5}
            value={autoCheckIntervalState}
            onChange={(e) => setAutoCheckIntervalState(Math.max(5, Number(e.target.value || 60)))}
          />
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
            Mínimo: 5 segundos
          </p>
        </div>
      </Modal>

      {/* Modal de Novo Endpoint */}
      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
          setError(null);
          setEndpointUrl("");
          setEndpointPriority(0);
        }}
        title="Novo endpoint"
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
              form="form-endpoint"
              className="btn btn--primary"
              disabled={submitting || !endpointUrl.trim()}
            >
              {submitting ? "Criando…" : "Criar"}
            </button>
          </>
        }
      >
        <form id="form-endpoint" onSubmit={handleCreateEndpoint}>
          <div className="input-group">
            <label htmlFor="endpoint-url">URL do endpoint</label>
            <input
              id="endpoint-url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://..."
              autoFocus
            />
          </div>
          <div className="input-group">
            <label htmlFor="endpoint-priority">Prioridade (maior = preferido)</label>
            <input
              id="endpoint-priority"
              type="number"
              value={endpointPriority}
              onChange={(e) => setEndpointPriority(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: "0.9rem", marginTop: "var(--space-2)" }}>
              {error}
            </p>
          )}
        </form>
      </Modal>

      {/* Lista de endpoints */}
      {product.endpoints.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ padding: "var(--space-12)" }}
        >
          <div className="empty-state">
            <h3>Nenhum endpoint</h3>
            <p>Adicione endpoints para esta campanha (URLs de checkout).</p>
            <button type="button" className="btn btn--primary" onClick={() => setModal(true)}>
              Novo endpoint
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="endpoints-list"
        >
          {product.endpoints.map((e) => (
            <motion.div key={e.id} variants={item}>
              <motion.div
                className="card endpoint-card"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="endpoint-card-content">
                  <div className="endpoint-card-info">
                    <h3 className="endpoint-url">{e.url}</h3>
                    <p className="endpoint-meta">
                      Prioridade: {e.priority} ·
                      <span className={e.isActive ? "status-active" : "status-inactive"}>
                        {e.isActive ? " Ativo" : " Inativo"}
                      </span>
                    </p>
                  </div>
                  <div className="endpoint-card-actions">
                    <button
                      className="btn btn--ghost"
                      onClick={async () => {
                        try {
                          toast.show("Verificando endpoint...", "info", 2000);
                          const res = await api.endpoints.check(e.id);
                          if (res?.ok) {
                            toast.show("✓ Endpoint funcionando corretamente", "success");
                          } else {
                            // Mensagem de erro detalhada
                            const errorMsg = res?.error ?? "Erro desconhecido";
                            const wasDeactivated = res?.wasDeactivated;

                            if (wasDeactivated) {
                              toast.show(`✗ ${errorMsg}. Endpoint foi desativado.`, "error", 6000);
                            } else {
                              toast.show(`✗ ${errorMsg}`, "error", 5000);
                            }
                          }
                          fetchProduct();
                        } catch (err) {
                          toast.show("Erro de conexão ao verificar endpoint", "error");
                          console.error(err);
                        }
                      }}
                    >
                      Verificar
                    </button>
                    <button
                      className="btn btn--ghost"
                      onClick={() => setEditEndpoint({ id: e.id, url: e.url, priority: e.priority })}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn--ghost btn--danger-text"
                      onClick={async () => {
                        if (!confirm("Remover endpoint?")) return;
                        try {
                          await api.endpoints.delete(e.id);
                          toast.show("Endpoint removido", "success");
                          fetchProduct();
                        } catch (err) {
                          toast.show("Erro ao remover", "error");
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal de Editar Endpoint */}
      {editEndpoint && (
        <Modal
          open={!!editEndpoint}
          onClose={() => setEditEndpoint(null)}
          title="Editar endpoint"
          footer={
            <>
              <button type="button" className="btn btn--secondary" onClick={() => setEditEndpoint(null)}>Cancelar</button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={async () => {
                  try {
                    await api.endpoints.update(editEndpoint.id, { url: editEndpoint.url, priority: editEndpoint.priority });
                    toast.show("Endpoint atualizado", "success");
                    setEditEndpoint(null);
                    fetchProduct();
                  } catch (err) {
                    toast.show("Erro ao atualizar", "error");
                  }
                }}
              >
                Salvar
              </button>
            </>
          }
        >
          <div className="input-group">
            <label>URL</label>
            <input value={editEndpoint.url} onChange={(e) => setEditEndpoint({ ...editEndpoint, url: e.target.value })} />
          </div>
          <div className="input-group">
            <label>Prioridade</label>
            <input type="number" value={editEndpoint.priority} onChange={(e) => setEditEndpoint({ ...editEndpoint, priority: Number(e.target.value) })} />
          </div>
        </Modal>
      )}
    </>
  );
}
