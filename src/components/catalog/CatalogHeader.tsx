// src/components/catalog/CatalogHeader.tsx
import Link from "next/link";
import { GraduationCap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogTenant } from "@/types/catalog";

interface CatalogHeaderProps {
  tenant: CatalogTenant;
  tenantSlug: string;
}

export function CatalogHeader({ tenant, tenantSlug }: CatalogHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-sm"
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo / Nome */}
        <Link
          href={`/${tenantSlug}/catalog`}
          className="flex items-center gap-2.5 group"
          aria-label={`Catálogo de ${tenant.name}`}
        >
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={`Logo ${tenant.name}`}
              className="h-9 object-contain"
            />
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D1F3C]">
                <GraduationCap className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <span className="text-sm font-bold text-[#0D1F3C] group-hover:text-[#1a3460] transition-colors">
                {tenant.platformName || tenant.name}
              </span>
            </>
          )}
        </Link>

        {/* Ações */}
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-1 text-sm font-medium text-[#6B7280] hover:text-[#0D1F3C] transition-colors"
            aria-label="Selecionar idioma"
          >
            PT
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <Button
            asChild
            className="bg-[#0D1F3C] text-white hover:bg-[#1a3460] h-9 px-5 text-sm font-semibold rounded-lg shadow-sm transition-all"
          >
            <Link href={`/${tenantSlug}/login`}>Entrar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
