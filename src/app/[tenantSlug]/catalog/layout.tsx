// src/app/[tenantSlug]/catalog/layout.tsx
// Minimal layout — header/footer are rendered by page.tsx (full-page control)
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { Analytics } from "@vercel/analytics/react";

export async function generateMetadata({
  params,
}: {
  params: { tenantSlug: string };
}): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug },
    select: { name: true, platformName: true },
  });
  if (!tenant) return { title: "Catálogo", robots: { index: false } };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    title: {
      default: `Catálogo de Formação | ${tenant.platformName || tenant.name}`,
      template: `%s | ${tenant.platformName || tenant.name}`,
    },
    description: `Explore os cursos certificados DGERT da ${tenant.name}.`,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${baseUrl.replace(/\/$/, "")}/${params.tenantSlug}/catalog`,
    },
  };
}

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Analytics />
    </>
  );
}
