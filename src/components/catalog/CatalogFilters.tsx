"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrainingArea } from "@prisma/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface CatalogFiltersProps {
  areas: TrainingArea[];
}

export function CatalogFilters({ areas }: CatalogFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [areaId, setAreaId] = useState(searchParams.get("area") || "all");
  const [format, setFormat] = useState(searchParams.get("format") || "all");
  const [duration, setDuration] = useState(searchParams.get("duration") || "all");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters({ q: search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const updateFilters = (newValues: Record<string, string>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    Object.entries(newValues).forEach(([key, value]) => {
      if (!value || value === "all") {
        current.delete(key);
      } else {
        current.set(key, value);
      }
    });

    const query = current.toString();
    router.push(`?${query}`, { scroll: false });
  };

  return (
    <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Pesquisa */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Pesquisar cursos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Área */}
        <Select
          value={areaId}
          onValueChange={(val) => {
            setAreaId(val);
            updateFilters({ area: val });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Área Temática" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Modalidade */}
        <Select
          value={format}
          onValueChange={(val) => {
            setFormat(val);
            updateFilters({ format: val });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Modalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Modalidades</SelectItem>
            <SelectItem value="PRESENCIAL">Presencial</SelectItem>
            <SelectItem value="ELEARNING">E-Learning</SelectItem>
            <SelectItem value="BLENDED">Blended</SelectItem>
          </SelectContent>
        </Select>

        {/* Duração */}
        <Select
          value={duration}
          onValueChange={(val) => {
            setDuration(val);
            updateFilters({ duration: val });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Duração" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer Duração</SelectItem>
            <SelectItem value="0-4">Até 4h</SelectItem>
            <SelectItem value="4-8">4h a 8h</SelectItem>
            <SelectItem value="8-16">8h a 16h</SelectItem>
            <SelectItem value="16+">+16h</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
