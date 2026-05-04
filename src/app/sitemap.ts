import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
  });

  const courses = await prisma.course.findMany({
    where: { status: { in: ["PUBLISHED", "FEATURED"] } },
    select: {
      slug: true,
      updatedAt: true,
      status: true,
      tenant: { select: { slug: true } },
    },
  });

  const entries: MetadataRoute.Sitemap = [];

  // Páginas-raiz por tenant
  for (const t of tenants) {
    entries.push({
      url: `${baseUrl}/${t.slug}/catalog`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly",
      priority: 1.0,
    });
    entries.push({
      url: `${baseUrl}/${t.slug}/catalog/workshops`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    });
  }

  // Cada curso publicado
  for (const c of courses) {
    entries.push({
      url: `${baseUrl}/${c.tenant.slug}/catalog/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: c.status === "FEATURED" ? 0.9 : 0.8,
    });
  }
  return entries;
}
