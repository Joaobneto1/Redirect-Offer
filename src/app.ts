import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { handleGo } from "./routes/go.js";
import api from "./routes/api/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const frontendDist = path.join(projectRoot, "frontend", "dist");
const frontendDistAlt = path.join(process.cwd(), "frontend", "dist");
const hasFrontend = fs.existsSync(frontendDist) || fs.existsSync(frontendDistAlt);
const staticDir = fs.existsSync(frontendDist) ? frontendDist : frontendDistAlt;

const app = express();

app.set("etag", false);
app.use(cors({ origin: true }));
app.use(express.json());

// API e redirecionamento primeiro
app.get("/go/:slug", handleGo);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.use("/api", api);

// Frontend estático (apenas em produção, quando frontend/dist existe)
if (hasFrontend) {
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.status(200).send(`
      <h1>Redirect Offer</h1>
      <p>API OK. Frontend não encontrado (pasta frontend/dist ausente).</p>
      <p>Rotas: <a href="/health">/health</a> | <a href="/api/overview">/api/overview</a></p>
    `);
  });
}

export default app;
