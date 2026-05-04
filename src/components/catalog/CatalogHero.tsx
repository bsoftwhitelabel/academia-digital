// src/components/catalog/CatalogHero.tsx
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CatalogHeroProps {
  tenantSlug: string;
}

export function CatalogHero({ tenantSlug }: CatalogHeroProps) {
  return (
    <section
      className="bg-[#0D1F3C] py-20 px-6"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        {/* Badge Certificação */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#C9A520] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0D1F3C]">
          <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Certificação Oficial
        </div>

        {/* H1 */}
        <h1
          id="hero-heading"
          className="text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl"
        >
          Formação Profissional<br className="hidden md:block" /> Certificada DGERT
        </h1>

        {/* Subtítulo */}
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
          Eleve as suas competências com cursos desenhados por especialistas da
          indústria. Formação flexível, prática e reconhecida em todo o mercado
          nacional.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            asChild
            className="h-12 rounded-xl bg-white px-8 text-sm font-semibold text-[#0D1F3C] hover:bg-white/90 transition-all shadow-md"
          >
            <Link href={`#cursos`}>Ver Catálogo</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-xl border-2 border-white bg-transparent px-8 text-sm font-semibold text-white hover:bg-white/10 transition-all"
          >
            <Link href={`/${tenantSlug}/catalog#contacto`}>
              Falar com Consultor
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
