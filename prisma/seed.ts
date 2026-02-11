import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Carregar .env do diretório raiz do projeto (não da pasta prisma)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const url = process.env.DATABASE_URL;
if (!url || !url.includes("@")) {
  console.error("ERRO: DATABASE_URL não encontrada ou inválida no .env");
  console.error("Verifique se o arquivo .env na raiz do projeto contém:");
  console.error('  DATABASE_URL="postgresql://usuario:senha@host:porta/banco"');
  process.exit(1);
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SUPERADMIN_PASSWORD = "Senha123admin"; // Mesma senha do INITIAL_SUPERADMINS em superadmin.ts

const SUPERADMINS = [
  { email: "muriloalbuquerquemartins@gmail.com", name: "Murilo" },
  { email: "joaobneto03@outlook.com", name: "João" },
];

async function main() {
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

  for (const { email, name } of SUPERADMINS) {
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      create: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: "SUPERADMIN",
        isActive: true,
      } as Parameters<typeof prisma.user.upsert>[0]["create"],
      update: {
        role: "SUPERADMIN",
        isActive: true,
        passwordHash,
      } as Parameters<typeof prisma.user.upsert>[0]["update"],
    });
    console.log(`  Superadmin: ${user.email}`);
  }

  console.log("Seed OK: contas superadmin criadas");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
