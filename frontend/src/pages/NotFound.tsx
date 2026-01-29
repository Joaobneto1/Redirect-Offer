import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        textAlign: "center",
        padding: "var(--space-16) var(--space-8)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(4rem, 12vw, 8rem)",
          color: "var(--text-muted)",
          margin: "0 0 var(--space-4)",
          letterSpacing: "-0.04em",
        }}
      >
        404
      </h1>
      <p className="page-desc" style={{ marginBottom: "var(--space-6)" }}>
        Página não encontrada.
      </p>
      <Link to="/" className="btn btn--primary">
        Voltar ao início
      </Link>
    </motion.div>
  );
}
