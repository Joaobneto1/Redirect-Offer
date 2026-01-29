import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed a sample campaign with two endpoints and a campaign link (slug)
  const campaign = await prisma.campaign.upsert({
    where: { id: "seed-campaign-1" },
    create: {
      id: "seed-campaign-1",
      name: "Campanha Demo",
    },
    update: { name: "Campanha Demo" },
  });

  const endpoint1 = await prisma.endpoint.upsert({
    where: { id: "seed-endpoint-1" },
    create: {
      id: "seed-endpoint-1",
      campaignId: campaign.id,
      url: "https://httpbin.org/status/200",
      priority: 0,
    },
    update: {
      url: "https://httpbin.org/status/200",
      priority: 0,
    },
  });

  const endpoint2 = await prisma.endpoint.upsert({
    where: { id: "seed-endpoint-2" },
    create: {
      id: "seed-endpoint-2",
      campaignId: campaign.id,
      url: "https://httpbin.org/redirect-to?url=https://example.com&status_code=302",
      priority: 1,
    },
    update: {
      url: "https://httpbin.org/redirect-to?url=https://example.com&status_code=302",
      priority: 1,
    },
  });

  const link = await prisma.campaignLink.upsert({
    where: { slug: "demo" },
    create: {
      slug: "demo",
      campaignId: campaign.id,
      fallbackUrl: "https://example.com",
    },
    update: {
      fallbackUrl: "https://example.com",
    },
  });

  console.log("Seed OK:");
  console.log("  Campaign:", campaign.name);
  console.log("  Endpoints:", endpoint1.id, endpoint2.id);
  console.log("  Campaign link: /go/demo");
  console.log("  Fallback:", link.fallbackUrl);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
