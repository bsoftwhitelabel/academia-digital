// src/components/catalog/CorporateCTA.tsx
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CorporateCTA() {
  return (
    <section
      id="contacto"
      className="mx-auto max-w-7xl px-6"
      aria-labelledby="cta-heading"
    >
      <div className="mt-12 mb-8 rounded-xl bg-[#DCE5F5] p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Texto principal */}
          <div className="lg:col-span-2">
            <h3
              id="cta-heading"
              className="text-xl font-semibold text-[#0D1F3C] leading-snug"
            >
              Precisa de formação personalizada para a sua empresa?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
              Criamos planos curriculares adaptados aos objetivos estratégicos
              do seu negócio. Consultoria gratuita.
            </p>
            <Button
              className="mt-6 h-11 rounded-xl bg-[#0D1F3C] px-6 text-sm font-semibold text-white hover:bg-[#1a3460] transition-all"
              aria-label="Solicitar proposta de formação para empresa"
            >
              Solicitar Proposta Empresa
            </Button>
          </div>

          {/* Card Corporativo */}
          <div className="flex items-center justify-center">
            <div className="flex w-full flex-col items-center justify-center gap-3 rounded-xl bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C9A520]/10">
                <Building2
                  className="h-6 w-6 text-[#C9A520]"
                  aria-hidden="true"
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#0D1F3C]">
                  Soluções Corporativas
                </p>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  + de 500 empresas já formadas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
