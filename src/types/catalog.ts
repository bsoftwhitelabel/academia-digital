// src/types/catalog.ts
// Tipos locais para o Catálogo Público

export interface CatalogArea {
  id: string;
  name: string;
  citeCode?: string | null;
}

export interface CatalogCourse {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  durationHours: number;
  format: "PRESENCIAL" | "ELEARNING" | "BLENDED";
  status: "DRAFT" | "PUBLISHED" | "FEATURED" | "ARCHIVED";
  coverImageUrl?: string | null;
  price?: number | null;
  area?: CatalogArea | null;
}

export interface CatalogTenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  platformName?: string | null;
  dgertCode?: string | null;
}
