// src/components/catalog/CourseCard.tsx (v2 — spec do catálogo público)
import Link from "next/link";
import { Clock, Monitor, Users, Layers, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CatalogCourse } from "@/types/catalog";

interface CourseCardProps {
  course: CatalogCourse;
  tenantSlug: string;
}

const FORMAT_ICON = {
  ELEARNING: Monitor,
  PRESENCIAL: Users,
  BLENDED: Layers,
} as const;

const FORMAT_LABEL = {
  ELEARNING: "E-learning",
  PRESENCIAL: "Presencial",
  BLENDED: "Híbrido",
} as const;

export function CourseCard({ course, tenantSlug }: CourseCardProps) {
  const isFeatured = course.status === "FEATURED";
  const FormatIcon = FORMAT_ICON[course.format] ?? Layers;
  const formatLabel = FORMAT_LABEL[course.format] ?? course.format;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl bg-white transition-all hover:shadow-lg ${
        isFeatured
          ? "border-2 border-[#C9A520] shadow-md"
          : "border border-[#E5E7EB]"
      }`}
      aria-label={course.name}
    >
      {/* Imagem */}
      <div className="relative aspect-video w-full overflow-hidden">
        {course.coverImageUrl ? (
          <img
            src={course.coverImageUrl}
            alt={`Imagem do curso ${course.name}`}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0D1F3C] to-[#1a3460]">
            <Monitor className="h-12 w-12 text-white/20" aria-hidden="true" />
          </div>
        )}
        {/* Badge DESTAQUE */}
        {isFeatured && (
          <span className="absolute left-3 top-3 rounded bg-[#C9A520] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0D1F3C]">
            Destaque
          </span>
        )}
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col p-5">
        {/* Badge Categoria */}
        {course.area && (
          <span className="mb-3 inline-block rounded-md bg-[#EEF2FA] px-2.5 py-1 text-xs font-semibold text-[#0D1F3C]">
            {course.area.name}
          </span>
        )}

        {/* Título */}
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[#0D1F3C]">
          {course.name}
        </h3>

        {/* Metadados */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#6B7280]">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {course.durationHours}h
          </span>
          <span className="flex items-center gap-1">
            <FormatIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {formatLabel}
          </span>
        </div>

        {/* Rodapé */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-lg font-semibold text-[#0D1F3C]">
            {course.price != null ? `${course.price}€` : "Sob Consulta"}
          </span>
          <Button
            asChild
            size="sm"
            className={`gap-1.5 rounded-lg text-sm font-semibold ${
              isFeatured
                ? "bg-[#0D1F3C] text-white hover:bg-[#1a3460]"
                : "border border-[#0D1F3C] bg-white text-[#0D1F3C] hover:bg-[#EEF2FA]"
            }`}
            variant={isFeatured ? "default" : "outline"}
          >
            <Link href={`/${tenantSlug}/catalog/${course.slug}`}>
              Saber Mais
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
