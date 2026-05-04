"use client";
// src/components/catalog/CourseGrid.tsx
// Client Component — recebe lista inicial e estado de filtro

import { useState, useCallback } from "react";
import { BookOpen } from "lucide-react";
import { CourseCard } from "@/components/catalog/CourseCard";
import { CatalogFilterBar } from "@/components/catalog/CatalogFilterBar";
import type { CatalogArea, CatalogCourse } from "@/types/catalog";

interface CourseGridProps {
  courses: CatalogCourse[];
  areas: CatalogArea[];
  tenantSlug: string;
}

export function CourseGrid({ courses, areas, tenantSlug }: CourseGridProps) {
  const [filtered, setFiltered] = useState<CatalogCourse[]>(courses);

  const handleFilter = useCallback((result: CatalogCourse[]) => {
    setFiltered(result);
  }, []);

  return (
    <section id="cursos" aria-labelledby="cursos-heading">
      {/* Filter Bar */}
      <CatalogFilterBar areas={areas} courses={courses} onFilter={handleFilter} />

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="mb-4 h-14 w-14 text-[#E5E7EB]" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-[#0D1F3C]">
              Nenhum curso encontrado
            </h3>
            <p className="mt-1 text-sm text-[#6B7280]">
              Tente ajustar os filtros ou o termo de pesquisa.
            </p>
          </div>
        ) : (
          <>
            <h2
              id="cursos-heading"
              className="sr-only"
            >
              Lista de Cursos
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  tenantSlug={tenantSlug}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
