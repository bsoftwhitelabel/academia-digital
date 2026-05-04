// src/app/[tenantSlug]/catalog/page.tsx — v2 Public Catalog Page
// Server Component: busca dados, passa para Client Components
import { notFound } from "next/navigation";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { CatalogHero } from "@/components/catalog/CatalogHero";
import { CourseGrid } from "@/components/catalog/CourseGrid";
import { CorporateCTA } from "@/components/catalog/CorporateCTA";
import { CatalogFooter } from "@/components/catalog/CatalogFooter";
import type { CatalogCourse, CatalogArea, CatalogTenant } from "@/types/catalog";

// ---------------------------------------------------------------------------
// Metadata SEO
// ---------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: { tenantSlug: string };
}): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug },
    select: { name: true, platformName: true, slug: true },
  });
  if (!tenant) return { title: "Catálogo", robots: { index: false } };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    title: `Catálogo de Formação | ${tenant.platformName || tenant.name}`,
    description: `Explore os cursos certificados DGERT da ${tenant.name}. Formação profissional flexível, prática e reconhecida em todo o mercado nacional.`,
    openGraph: {
      type: "website",
      locale: "pt_PT",
      siteName: tenant.platformName || tenant.name,
    },
    alternates: {
      canonical: `${baseUrl.replace(/\/$/, "")}/${tenant.slug}/catalog`,
    },
    robots: { index: true, follow: true },
  };
}

// ---------------------------------------------------------------------------
// Mock cursos para preview — TODO: remover quando dados reais existirem
// Usado apenas se prisma.course.findMany() retornar array vazio
// ---------------------------------------------------------------------------
const MOCK_COURSES: CatalogCourse[] = [
  {
    id: "mock-1",
    slug: "mba-lideranca-digital",
    name: "MBA Executivo em Liderança Digital",
    shortDescription: "Desenvolva as competências de liderança para a era digital.",
    durationHours: 90,
    format: "ELEARNING",
    status: "FEATURED",
    coverImageUrl: "/courses/placeholder.jpg",
    price: 490,
    area: { id: "a1", name: "Gestão e Negócios" },
  },
  {
    id: "mock-2",
    slug: "desenvolvimento-web-fullstack-nextjs",
    name: "Desenvolvimento Web Full-Stack Next.js",
    shortDescription: "Domine React, Next.js e Node.js com projetos reais.",
    durationHours: 250,
    format: "PRESENCIAL",
    status: "PUBLISHED",
    coverImageUrl: "/courses/placeholder.jpg",
    price: 1200,
    area: { id: "a2", name: "Tecnologia" },
  },
  {
    id: "mock-3",
    slug: "estrategia-marketing-digital-360",
    name: "Estratégia de Marketing Digital 360º",
    shortDescription: "Planeamento estratégico e ferramentas de marketing digital.",
    durationHours: 60,
    format: "BLENDED",
    status: "PUBLISHED",
    coverImageUrl: "/courses/placeholder.jpg",
    price: 350,
    area: { id: "a3", name: "Marketing" },
  },
  {
    id: "mock-4",
    slug: "ui-ux-design-masterclass",
    name: "UI/UX Design Masterclass",
    shortDescription: "Do protótipo ao produto final: domina Figma e design systems.",
    durationHours: 90,
    format: "ELEARNING",
    status: "PUBLISHED",
    coverImageUrl: "/courses/placeholder.jpg",
    price: 420,
    area: { id: "a4", name: "Design" },
  },
  {
    id: "mock-5",
    slug: "gestao-projetos-ageis-scrum",
    name: "Gestão de Projetos Ágeis (Scrum)",
    shortDescription: "Certificação oficial Scrum Master aplicada a casos reais.",
    durationHours: 40,
    format: "BLENDED",
    status: "FEATURED",
    coverImageUrl: "/courses/placeholder.jpg",
    price: 290,
    area: { id: "a1", name: "Gestão e Negócios" },
  },
  {
    id: "mock-6",
    slug: "analise-dados-python",
    name: "Análise de Dados com Python",
    shortDescription: "Pandas, NumPy e visualização de dados para profissionais.",
    durationHours: 50,
    format: "ELEARNING",
    status: "PUBLISHED",
    coverImageUrl: "/courses/placeholder.jpg",
    price: 550,
    area: { id: "a2", name: "Tecnologia" },
  },
];

const MOCK_AREAS: CatalogArea[] = [
  { id: "a1", name: "Gestão" },
  { id: "a2", name: "Tecnologia" },
  { id: "a3", name: "Design" },
];

// ---------------------------------------------------------------------------
// Page Component (Server)
// ---------------------------------------------------------------------------
export default async function CatalogPage({
  params,
}: {
  params: { tenantSlug: string };
}) {
  // ── 1. Fetch tenant ──────────────────────────────────────────────────────
  const tenantRaw = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
      platformName: true,
      dgertCode: true,
    },
  });
  if (!tenantRaw) notFound();

  const tenant: CatalogTenant = {
    id: tenantRaw.id,
    name: tenantRaw.name,
    slug: tenantRaw.slug,
    logoUrl: tenantRaw.logoUrl,
    primaryColor: tenantRaw.primaryColor,
    accentColor: tenantRaw.accentColor,
    platformName: tenantRaw.platformName,
    dgertCode: tenantRaw.dgertCode,
  };

  // ── 2. Fetch cursos publicados + área ─────────────────────────────────────
  const rawCourses = await prisma.course.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: ["PUBLISHED", "FEATURED"] },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      durationHours: true,
      format: true,
      status: true,
      coverImageUrl: true,
      price: true,
      area: { select: { id: true, name: true, citeCode: true } },
    },
    orderBy: [
      { status: "desc" }, // FEATURED vem primeiro (alphabetically after PUBLISHED)
      { createdAt: "desc" },
    ],
  });

  // ── 3. Buscar áreas ativas para os chips de filtro ────────────────────────
  const rawAreas = await prisma.trainingArea.findMany({
    where: { isActive: true, catalogVisible: true },
    select: { id: true, name: true, citeCode: true },
    orderBy: { catalogOrder: "asc" },
  });

  // ── 4. Mapear para tipos locais + fallback para mocks ─────────────────────
  const courses: CatalogCourse[] =
    rawCourses.length > 0
      ? rawCourses.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          shortDescription: c.shortDescription,
          durationHours: c.durationHours,
          format: c.format as CatalogCourse["format"],
          status: c.status as CatalogCourse["status"],
          coverImageUrl: c.coverImageUrl,
          price: c.price,
          area: c.area
            ? { id: c.area.id, name: c.area.name, citeCode: c.area.citeCode }
            : null,
        }))
      : MOCK_COURSES; // TODO: remover fallback quando dados reais existirem

  const areas: CatalogArea[] =
    rawAreas.length > 0
      ? rawAreas.map((a) => ({ id: a.id, name: a.name, citeCode: a.citeCode }))
      : MOCK_AREAS; // TODO: remover fallback quando dados reais existirem

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FB]">
      {/* Header */}
      <CatalogHeader tenant={tenant} tenantSlug={params.tenantSlug} />

      {/* Hero */}
      <CatalogHero tenantSlug={params.tenantSlug} />

      {/* Grid de cursos com filtros inline (Client) */}
      <div className="flex-1 bg-[#F5F7FB]">
        <CourseGrid
          courses={courses}
          areas={areas}
          tenantSlug={params.tenantSlug}
        />
      </div>

      {/* CTA Corporativo */}
      <div className="bg-[#F5F7FB]">
        <CorporateCTA />
      </div>

      {/* Footer */}
      <CatalogFooter tenant={tenant} tenantSlug={params.tenantSlug} />
    </div>
  );
}
