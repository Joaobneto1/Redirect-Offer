import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";
import { loadConfig } from "../config.js";
import { prisma } from "../lib/prisma.js";

const config = loadConfig();

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Token obrigatório" });
    return;
  }

  const payload = verifyToken(token, config.JWT_SECRET);
  if (!payload) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }
  if (!user.isActive) {
    res.status(403).json({ error: "Conta desativada. Contate o administrador." });
    return;
  }

  (req as Request & { user: AuthUser }).user = {
    id: user.id,
    email: user.email,
    name: user.name,
  };
  next();
}
