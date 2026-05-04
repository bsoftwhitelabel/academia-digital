"use client";
// src/components/catalog/CatalogFilterBar.tsx
// Client Component — filtros inline por categoria + busca por texto

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CatalogArea, CatalogCourse } from "@/types/catalog";

interface CatalogFilterBarProps {
  areas: CatalogArea[];
  courses: CatalogCourse[];
  onFilter: (filtered: CatalogCourse[]) => void;
}

export function CatalogFilterBar({ areas, courses, onFilter }: CatalogFilterBarProps) {
  const [activeArea, setActiveArea] = useState<string>("all");
  const [search, setSearch] = useState("");

  const chips = [{ id: "all", name: "Todos" }, ...areas];

  const applyFilters = (areaId: string, term: string) => {
    let result = courses;
    if (areaId !== "all") {
      result = result.filter((c) => c.area?.id === areaId);
    }
    if (term.trim()) {
      const q = term.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.shortDescription?.toLowerCase().includes(q)
      );
    }
    onFilter(result);
  };

  const handleArea = (id: string) => {
    setActiveArea(id);
    applyFilters(id, search);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    applyFilters(activeArea, val);
  };

  return (
    <div className="border-b border-[#E5E7EB] bg-white py-5 px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Chips de categoria */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#6B7280] whitespace-nowrap">
            Filtrar por Área:
          </span>
          {chips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => handleArea(chip.id)}
              aria-pressed={activeArea === chip.id}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D1F3C] ${
                activeArea === chip.id
                  ? "bg-[#0D1F3C] text-white"
                  : "bg-[#EEF2FA] text-[#0D1F3C] hover:bg-[#dce5f5]"
              }`}
            >
              {chip.name}
            </button>
          ))}
        </div>

        {/* Input de busca */}
        <div className="relative w-full md:w-[280px]">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Procurar curso..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="border-[#E5E7EB] pl-9 text-sm focus-visible:ring-[#0D1F3C]"
            aria-label="Pesquisar cursos"
          />
        </div>
      </div>
    </div>
  );
}
