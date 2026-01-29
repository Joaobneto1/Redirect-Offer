import cors from "cors";
import express from "express";
import { handleGo } from "./routes/go.js";
import api from "./routes/api/index.js";

const app = express();

app.set("etag", false);
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/go/:slug", handleGo);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.use("/api", api);

export default app;
