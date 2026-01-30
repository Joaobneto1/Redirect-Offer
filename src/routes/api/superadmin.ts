import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// Credenciais dos superadmins iniciais (hardcoded - sempre funcionam)
const INITIAL_SUPERADMINS = [
  { email: "muriloalbuquerquemartins@gmail.com", password: "Senha@123" },
  { email: "joaobneto03@outlook.com", password: "Senha@123" },
];

// Cache de tokens válidos (email -> password para verificação)
const validTokens = new Map<string, { email: string; userId?: string }>();

// Middleware para verificar autenticação de superadmin
async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["x-superadmin-auth"];

  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({ error: "Não autenticado" });
  }

  // Verificar se o token está no cache
  const cached = validTokens.get(authHeader);
  if (cached) {
    return next();
  }

  // Tentar decodificar e validar
  try {
    const decoded = Buffer.from(authHeader, "base64").toString("utf-8");
    const [email, password] = decoded.split(":");

    // Verificar credenciais hardcoded
    const isInitialAdmin = INITIAL_SUPERADMINS.some(
      (admin) => admin.email === email && admin.password === password
    );

    if (isInitialAdmin) {
      validTokens.set(authHeader, { email });
      return next();
    }

    // Verificar no banco de dados
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user && user.role === "SUPERADMIN" && user.isActive) {
      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (passwordMatch) {
        validTokens.set(authHeader, { email, userId: user.id });
        return next();
      }
    }

    return res.status(403).json({ error: "Credenciais inválidas" });
  } catch {
    return res.status(401).json({ error: "Autenticação inválida" });
  }
}

// Verificar login do superadmin
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha obrigatórios" });
  }

  const emailLower = email.toLowerCase();

  // Verificar credenciais hardcoded primeiro
  const isInitialAdmin = INITIAL_SUPERADMINS.some(
    (admin) => admin.email.toLowerCase() === emailLower && admin.password === password
  );

  if (isInitialAdmin) {
    const token = Buffer.from(`${emailLower}:${password}`).toString("base64");
    validTokens.set(token, { email: emailLower });
    return res.json({ ok: true, token });
  }

  // Verificar no banco de dados
  const user = await prisma.user.findUnique({
    where: { email: emailLower },
  });

  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  if (user.role !== "SUPERADMIN") {
    return res.status(403).json({ error: "Acesso restrito a Super Admins" });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "Conta desativada" });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  // Retornar token base64 para usar nas requisições
  const token = Buffer.from(`${emailLower}:${password}`).toString("base64");
  validTokens.set(token, { email: emailLower, userId: user.id });
  return res.json({ ok: true, token });
});

// Aplicar middleware nas rotas protegidas
router.use(requireSuperAdmin);

const createUserSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha com pelo menos 6 caracteres"),
  name: z.string().max(120).optional(),
  role: z.enum(["SUPERADMIN", "USER"]).default("USER"),
});

const updateUserSchema = z.object({
  name: z.string().max(120).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["SUPERADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
});

// Listar usuários (com senha visível)
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        passwordText: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (err) {
    console.error("[GET /api/superadmin/users]", err);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

// Criar usuário
router.post("/users", async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join("; ");
      return res.status(400).json({ error: msg });
    }
    const { email, password, name, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: "E-mail já cadastrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        passwordText: password, // Salvar senha em texto
        name: name?.trim() || null,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        passwordText: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error("[POST /api/superadmin/users]", err);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

// Atualizar usuário
router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join("; ");
      return res.status(400).json({ error: msg });
    }

    const data: any = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.role !== undefined) data.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
      data.passwordText = parsed.data.password;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        passwordText: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (err) {
    console.error("[PATCH /api/superadmin/users/:id]", err);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

// Excluir usuário
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error("[DELETE /api/superadmin/users/:id]", err);
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
});

export default router;
