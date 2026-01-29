import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { loadConfig } from "../../config.js";
import { signToken } from "../../lib/auth.js";

const router = Router();
const config = loadConfig();

const registerSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha com pelo menos 6 caracteres"),
  name: z.string().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

function omitUser(u: { id: string; email: string; name: string | null; createdAt: Date }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join("; ");
    return res.status(400).json({ error: msg });
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: "E-mail já cadastrado" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name: name?.trim() || null,
    },
  });

  const token = signToken({ sub: user.id, email: user.email }, config.JWT_SECRET);
  return res.status(201).json({ user: omitUser(user), token });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join("; ");
    return res.status(400).json({ error: msg });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return res.status(401).json({ error: "E-mail ou senha inválidos" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "E-mail ou senha inválidos" });

  const token = signToken({ sub: user.id, email: user.email }, config.JWT_SECRET);
  return res.json({ user: omitUser(user), token });
});

router.get("/me", (req: Request, res: Response) => {
  const u = (req as Request & { user?: { id: string; email: string; name: string | null } }).user;
  if (!u) return res.status(401).json({ error: "Token obrigatório" });
  return res.json({ user: { id: u.id, email: u.email, name: u.name } });
});

export default router;
