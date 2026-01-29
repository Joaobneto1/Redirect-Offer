import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.upsert({
    where: { id: "seed-product-1" },
    create: {
      id: "seed-product-1",
      name: "Produto Demo",
    },
    update: {},
  });

  const group = await prisma.checkoutGroup.upsert({
    where: { id: "seed-group-1" },
    create: {
      id: "seed-group-1",
      productId: product.id,
      name: "Checkout Principal",
      rotationStrategy: "round-robin",
    },
    update: {},
  });

  await prisma.checkout.upsert({
    where: { id: "seed-checkout-1" },
    create: {
      id: "seed-checkout-1",
      groupId: group.id,
      url: "https://httpbin.org/status/200",
      priority: 0,
    },
    update: {},
  });

  await prisma.checkout.upsert({
    where: { id: "seed-checkout-2" },
    create: {
      id: "seed-checkout-2",
      groupId: group.id,
      url: "https://httpbin.org/redirect-to?url=https://example.com&status_code=302",
      priority: 0,
    },
    update: {},
  });

  const link = await prisma.smartLink.upsert({
    where: { slug: "demo" },
    create: {
      slug: "demo",
      groupId: group.id,
      fallbackUrl: "https://example.com",
    },
    update: {},
  });

  console.log("Seed OK:");
  console.log("  Product:", product.name);
  console.log("  Group:", group.name);
  console.log("  Smart link: /go/demo");
  console.log("  Fallback:", link.fallbackUrl);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
