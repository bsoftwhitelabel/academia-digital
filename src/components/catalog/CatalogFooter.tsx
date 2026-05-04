// src/components/catalog/CatalogFooter.tsx
import { GraduationCap, Globe, Users, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { CatalogTenant } from "@/types/catalog";

interface CatalogFooterProps {
  tenant: CatalogTenant;
  tenantSlug: string;
}

const INSTITUTIONAL_LINKS = [
  { label: "Sobre Nós", href: "#" },
  { label: "Certificações", href: "#" },
  { label: "Formadores", href: "#" },
  { label: "Contactos", href: "#" },
];

const SUPPORT_LINKS = [
  { label: "Perguntas Frequentes", href: "#" },
  { label: "Termos e Condições", href: "#" },
  { label: "Política de Privacidade", href: "#" },
  { label: "Livro de Reclamações", href: "#" },
];

export function CatalogFooter({ tenant, tenantSlug }: CatalogFooterProps) {
  return (
    <footer className="bg-[#0D1F3C] px-6 pt-14 pb-8 text-white" role="contentinfo">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Coluna 1: Identidade */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <GraduationCap className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <span className="font-bold text-white">
                {tenant.platformName || tenant.name}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Entidade formadora certificada pela DGERT. Excelência na formação
              profissional desde 2010, focada no desenvolvimento real de
              competências.
            </p>
            {/* Ícones sociais */}
            <div className="mt-5 flex items-center gap-4">
              <a
                href="#"
                aria-label="Website"
                className="text-white/50 transition-colors hover:text-white"
              >
                <Globe className="h-5 w-5" />
              </a>
              <a
                href="#"
                aria-label="Comunidade"
                className="text-white/50 transition-colors hover:text-white"
              >
                <Users className="h-5 w-5" />
              </a>
              <a
                href="#"
                aria-label="Blog"
                className="text-white/50 transition-colors hover:text-white"
              >
                <Lightbulb className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Coluna 2: Institucional */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
              Institucional
            </h4>
            <ul className="space-y-2.5">
              {INSTITUTIONAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 3: Suporte */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
              Suporte
            </h4>
            <ul className="space-y-2.5">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Linha inferior */}
        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
