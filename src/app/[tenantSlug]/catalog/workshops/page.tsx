import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { ShieldAlert, Calculator, Clock } from "lucide-react";
import { B2BProposalForm } from "@/components/catalog/B2BProposalForm";

interface WorkshopsPageProps {
  params: { tenantSlug: string };
}

const BLOCO_THEMES: Record<string, { title: string; emoji: string }> = {
  "bloco-1": { title: "Relação com o Trabalho", emoji: "💼" },
  "bloco-2": { title: "Comunicação e Relacionamento", emoji: "🤝" },
  "bloco-3": { title: "Foco e Produtividade", emoji: "🎯" },
  "bloco-4": { title: "Liderança e Saúde", emoji: "🌟" },
  "bloco-5": { title: "IA e Saúde Mental", emoji: "🤖" },
  "bloco-6": { title: "Saúde Física e Energia", emoji: "💪" },
  "bloco-7": { title: "Inteligência Emocional", emoji: "🧠" },
  "bloco-8": { title: "Parentalidade e Trabalho", emoji: "👨‍👩‍👧" },
  "bloco-9": { title: "Bem-Estar Financeiro", emoji: "💰" },
};

function getBlocoKey(tags: string[]): string | null {
  for (const t of tags) if (t.startsWith("bloco-")) return t;
  return null;
}

function workshopEmoji(course: any): string {
  // priceNotes começa com emoji do seed (ex: "🔥 Sob consulta...")
  return course.priceNotes?.split(" ")[0] || "✨";
}

export async function generateMetadata({ params }: WorkshopsPageProps): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: params.tenantSlug } });
  if (!tenant) return { title: "Workshops" };
  return {
    title: `Workshops de Saúde, Bem-Estar e Performance | ${tenant.name}`,
    description: "Soluções de desenvolvimento humano para a sua organização. 27 workshops em 9 blocos temáticos.",
    openGraph: {
      title: `Workshops | ${tenant.name}`,
      description: "Soluções de desenvolvimento humano para a sua organização.",
    },
  };
}

export default async function WorkshopsPage({ params }: WorkshopsPageProps) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: params.tenantSlug } });
  if (!tenant) notFound();

  const workshops = await prisma.course.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: ["PUBLISHED", "FEATURED"] },
      OR: [
        { tags: { has: "workshop" } },
        { tags: { has: "saude-mental" } },
        { tags: { has: "bem-estar" } },
        { name: { contains: "Workshop", mode: "insensitive" } },
      ],
    },
    orderBy: [{ tags: "asc" }, { name: "asc" }],
  });

  // Agrupar por bloco
  const grouped: Record<string, any[]> = {};
  for (const w of workshops) {
    const bloco = getBlocoKey(w.tags) || "bloco-outro";
    if (!grouped[bloco]) grouped[bloco] = [];
    grouped[bloco].push(w);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero — paleta verde própria */}
      <section className="bg-[#15803D] text-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-block rounded-full bg-white/20 px-4 py-1 text-xs font-bold uppercase tracking-widest">
              Programa B2B — Saúde Organizacional
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight md:text-5xl">
              Workshops de Saúde, Bem-Estar e Performance
            </h1>
            <p className="mt-4 text-lg text-emerald-50 md:text-xl">
              Soluções de desenvolvimento humano para a sua organização.
            </p>

            <div className="mt-10 rounded-xl bg-white/10 p-6 text-left backdrop-blur-sm md:p-8">
              <div className="flex items-start gap-4">
                <ShieldAlert className="mt-1 h-7 w-7 shrink-0 text-yellow-300" />
                <div>
                  <h2 className="text-lg font-bold md:text-xl">
                    As empresas são legalmente responsáveis pela saúde mental dos colaboradores.
                  </h2>
                  <p className="mt-2 text-emerald-50">
                    Em Portugal e no Brasil, a regulamentação já existe. <strong>Está preparado?</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="#workshops-grid"
                className="rounded-lg bg-white px-6 py-3 font-semibold text-[#15803D] shadow-lg hover:bg-gray-50"
                data-testid="cta-ver-workshops"
              >
                Ver todos os Workshops
              </a>
              <Link
                href={`/${params.tenantSlug}/catalog/workshops/calculator`}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-white px-6 py-3 font-semibold text-white hover:bg-white/10"
                data-testid="cta-calculadora"
              >
                <Calculator className="h-4 w-4" />
                Calcular impacto na minha empresa
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats / claims */}
      <section className="bg-emerald-50 py-12">
        <div className="container mx-auto grid grid-cols-1 gap-6 px-4 text-center md:grid-cols-3">
          <div>
            <div className="text-4xl font-extrabold text-[#15803D]">27</div>
            <p className="mt-1 text-sm text-gray-700">workshops em 9 blocos temáticos</p>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-[#15803D]">1h</div>
            <p className="mt-1 text-sm text-gray-700">duração compacta — encaixa no horário laboral</p>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-[#15803D]">B2B</div>
            <p className="mt-1 text-sm text-gray-700">soluções à medida — proposta sob consulta</p>
          </div>
        </div>
      </section>

      {/* Grid de workshops por bloco */}
      <section id="workshops-grid" className="container mx-auto px-4 py-16">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 md:text-3xl">
          Programa completo
        </h2>

        {Object.keys(BLOCO_THEMES).map((blocoKey) => {
          const items = grouped[blocoKey] || [];
          if (items.length === 0) return null;
          const theme = BLOCO_THEMES[blocoKey];
          return (
            <div key={blocoKey} className="mb-12">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800">
                <span className="text-2xl" aria-hidden>{theme.emoji}</span>
                {theme.title}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((w: any) => (
                  <Link
                    key={w.id}
                    href={`/${params.tenantSlug}/catalog/${w.slug}`}
                    className="group flex flex-col rounded-xl border-2 border-gray-100 bg-white p-5 transition hover:border-[#15803D] hover:shadow-lg"
                    data-testid={`workshop-card-${w.slug}`}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <span className="text-3xl" aria-hidden>{workshopEmoji(w)}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#15803D] px-3 py-1 text-xs font-bold text-white">
                        <Clock className="h-3 w-3" />
                        {w.durationHours}h
                      </span>
                    </div>
                    <h4 className="line-clamp-2 text-base font-bold leading-tight text-gray-900 group-hover:text-[#15803D]">
                      {w.name}
                    </h4>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-gray-600">
                      {w.shortDescription}
                    </p>
                    <span className="mt-4 inline-block text-sm font-semibold text-[#15803D] group-hover:underline">
                      Pedir Proposta →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Formulário B2B */}
      <section id="proposta" className="bg-gray-50 py-16">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Pronto para transformar a saúde da sua equipa?
            </h2>
            <p className="mt-3 text-gray-600">
              Cada organização é única. Vamos desenhar um programa adaptado às suas necessidades específicas.
            </p>
          </div>
          <B2BProposalForm
            tenantSlug={params.tenantSlug}
            workshops={workshops.map((w) => ({ id: w.id, name: w.name }))}
          />
          <div className="mt-6 text-center">
            <Link
              href={`/${params.tenantSlug}/catalog/workshops/calculator`}
              className="text-sm font-semibold text-[#15803D] underline"
            >
              Antes de submeter, calcule o impacto na sua organização →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer attribution */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="container mx-auto px-4 text-center text-xs text-gray-500">
          {tenant.name} · Workshops de Saúde, Bem-Estar e Performance
        </div>
      </footer>
    </div>
  );
}
