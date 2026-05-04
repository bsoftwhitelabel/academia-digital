import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");

  const entries: MetadataRoute.Sitemap = [];

  try {
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
  } catch {
    entries.push({
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    });
    entries.push({
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.2,
    });
  }
  return entries;
}
