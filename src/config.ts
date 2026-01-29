import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET com pelo menos 16 caracteres"),
  PORT: z.coerce.number().default(3000),
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().default(5000),
  HEALTH_CHECK_ALLOWED_STATUSES: z
    .string()
    .default("200,302")
    .transform((s) => s.split(",").map((n) => parseInt(n.trim(), 10))),
  FAILURE_THRESHOLD: z.coerce.number().default(3),
});

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Configuração inválida:", parsed.error.flatten());
    process.exit(1);
  }
  return parsed.data;
}
