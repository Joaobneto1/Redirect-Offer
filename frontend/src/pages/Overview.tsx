import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";

type OverviewStats = {
  campaigns: number;
  endpoints: number;
  links: number;
  activeEndpoints: number;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function Overview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [links, setLinks] = useState<Array<{ id: string; slug: string; campaign: { name: string } }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.overview(), api.smartLinks.list()])
      .then(([s, l]) => {
        setStats(s);
        setLinks(l.slice(0, 8));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        { label: "Campanhas", value: stats.campaigns, path: "/campaigns" },
        { label: "Endpoints", value: stats.endpoints, path: "/campaigns" },
        { label: "Ativos", value: stats.activeEndpoints, live: true },
        { label: "Links", value: stats.links, path: "/links" },
      ]
    : [];

  const goBase = typeof window !== "undefined" ? `${window.location.origin}/go` : "/go";

  return (
    <>
      <PageHeader
        title="Visão geral"
        desc="Resumo do sistema de links inteligentes e checkouts."
      />

      <motion.section
        variants={item}
        initial="hidden"
        animate="show"
        className="steps-guide"
        style={{ marginBottom: "var(--space-8)" }}
      >
        <h3>Passo a passo</h3>
        <ol className="steps-list">
              <li>
                <span className="step-num">1</span>
                <span className="step-text">
                  <strong>Campanha</strong> — Crie uma campanha em Campanhas. Ex.: "Black Friday".
                </span>
              </li>
              <li>
                <span className="step-num">2</span>
                <span className="step-text">
                  <strong>Endpoints</strong> — Dentro da campanha, adicione endpoints (URLs de checkout: Hotmart, Eduzz, etc.). Configure prioridade se necessário.
                </span>
              </li>
              <li>
                <span className="step-num">3</span>
                <span className="step-text">
                  Use <strong>Verificar</strong> para testar cada endpoint; o sistema faz validação profunda (URL final e HTML) para detectar ofertas inativas.
                </span>
              </li>
              <li>
                <span className="step-num">4</span>
                <span className="step-text">
                  <strong>Link inteligente</strong> — Crie um slug (ex.: demo). O link /go/demo tentará os endpoints configurados na campanha (ordem por prioridade/rotação). Se todos falharem, mostramos uma página de fallback.
                </span>
              </li>
        </ol>
      </motion.section>

      {loading ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="page-desc"
          style={{ marginTop: "var(--space-8)" }}
        >
          Carregando…
        </motion.p>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
        >
          <motion.section variants={item}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "var(--space-4)",
              }}
              className="overview-cards"
            >
              {cards.map((c) => {
                const CardInner = (
                  <motion.div
                    className="card"
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      padding: "var(--space-6)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {c.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: "1.75rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                      }}
                    >
                      {c.value}
                      {c.live && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--live)",
                            boxShadow: "0 0 10px var(--live-glow)",
                          }}
                        />
                      )}
                    </span>
                  </motion.div>
                );
                return c.path ? (
                  <Link
                    key={c.label}
                    to={c.path}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {CardInner}
                  </Link>
                ) : (
                  <div key={c.label}>{CardInner}</div>
                );
              })}
            </div>
          </motion.section>

          <motion.section variants={item}>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Links recentes</h2>
                <Link to="/links" className="btn btn--ghost">
                  Ver todos
                </Link>
              </div>
              <div className="card-body" style={{ paddingTop: 0 }}>
                  {links.length === 0 ? (
                    <p className="page-desc" style={{ margin: 0 }}>
                      Nenhum link criado. Crie um em Campanhas → Endpoints → Links.
                    </p>
                  ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                      <tr>
                        <th>Slug</th>
                        <th>Campanha</th>
                        <th>URL</th>
                      </tr>
                      </thead>
                      <tbody>
                        {links.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <span className="mono">{l.slug}</span>
                          </td>
                          <td>{l.campaign?.name ?? "—"}</td>
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
      )}
    </>
  );
}
