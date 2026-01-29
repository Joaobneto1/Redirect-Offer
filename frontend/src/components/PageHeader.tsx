import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, desc, action }: PageHeaderProps) {
  return (
    <motion.header
      className="page-header"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-4)" }}
    >
      <div>
        <h1 className="page-title">{title}</h1>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      {action}
    </motion.header>
  );
}
