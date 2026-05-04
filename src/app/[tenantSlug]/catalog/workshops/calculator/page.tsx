"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Calculator, ShieldAlert, ArrowRight } from "lucide-react";

// Constantes da fórmula (fonte: EU-OSHA / OIT — estimativas conservadoras)
const ABSENT_RATE_BY_STRESS = 0.15;       // 15% dos colaboradores afetados/ano
const ABSENT_DAYS_PER_AFFECTED = 25;       // dias por colaborador afetado/ano
const AVERAGE_DAILY_COST = 80;             // €/dia (salário + encargos médio PT)
const BENEFIT_REDUCTION = 0.23;            // 23% redução com programas estruturados
const ROI_RATIO = 4;                       // €4 retorno por €1 investido (mediana)

const SETORES = [
  "Tecnologia / IT",
  "Saúde",
  "Educação",
  "Comércio / Retalho",
  "Indústria",
  "Serviços financeiros",
  "Construção",
  "Hotelaria / Restauração",
  "Administração pública",
  "Outro",
];

const DESAFIOS = [
  "Absentismo",
  "Rotatividade",
  "Baixa produtividade",
  "Conflitos internos",
  "Burnout",
  "Adaptação à IA",
];

function fmtEur(n: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function WorkshopsCalculatorPage() {
  const params = useParams<{ tenantSlug: string }>();
  const [count, setCount] = useState(100);
  const [setor, setSetor] = useState(SETORES[0]);
  const [desafios, setDesafios] = useState<string[]>(["Burnout"]);

  const stats = useMemo(() => {
    const annualCost = count * ABSENT_RATE_BY_STRESS * ABSENT_DAYS_PER_AFFECTED * AVERAGE_DAILY_COST;
    const savings = annualCost * BENEFIT_REDUCTION;
    return {
      annualCost,
      savings,
      roi: ROI_RATIO,
    };
  }, [count]);

  const toggleDesafio = (d: string) =>
    setDesafios((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const proposalLink =
    `/${params.tenantSlug}/catalog/workshops?` +
    new URLSearchParams({
      from: "calculator",
      employees: String(count),
      setor,
      desafios: desafios.join(","),
    }).toString() + "#proposta";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Header */}
      <header className="bg-[#15803D] text-white">
        <div className="container mx-auto px-4 py-12 text-center">
          <Link href={`/${params.tenantSlug}/catalog/workshops`} className="text-sm text-emerald-100 hover:underline">
            ← Voltar aos workshops
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
            <Calculator className="mr-2 inline-block h-8 w-8" />
            Calcule o impacto dos workshops na sua organização
          </h1>
          <p className="mt-2 text-emerald-50">
            Modelo baseado em dados da EU-OSHA e Organização Internacional do Trabalho.
          </p>
        </div>
      </header>

      <main className="container mx-auto grid grid-cols-1 gap-8 px-4 py-12 lg:grid-cols-2">
        {/* Inputs */}
        <section className="rounded-xl border-2 border-emerald-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Os seus dados</h2>

          <div className="mt-6 space-y-6">
            {/* Slider de colaboradores */}
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                <span>Nº de colaboradores</span>
                <span className="text-2xl font-bold text-[#15803D]" data-testid="emp-count">{count}</span>
              </label>
              <input
                type="range" min="10" max="5000" step="10"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-2 w-full accent-[#15803D]"
                data-testid="emp-slider"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>10</span><span>1000</span><span>5000</span>
              </div>
            </div>

            {/* Setor */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Setor de atividade</label>
              <select
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                data-testid="setor-select"
              >
                {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Desafios */}
            <div>
              <p className="text-sm font-medium text-gray-700">Principais desafios</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {DESAFIOS.map((d) => {
                  const active = desafios.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDesafio(d)}
                      data-testid={`desafio-${d}`}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        active
                          ? "border-[#15803D] bg-emerald-50 font-semibold text-[#15803D]"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      {active ? "✓ " : ""}{d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Output */}
        <section className="space-y-4">
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Custo anual estimado</p>
                <p className="mt-2 text-3xl font-extrabold text-amber-900" data-testid="annual-cost">
                  {fmtEur(stats.annualCost)} / ano
                </p>
                <p className="mt-2 text-sm text-amber-900">
                  Com <strong>{count}</strong> colaboradores no setor de <strong>{setor}</strong>,
                  estima-se que o absentismo por stress custe à sua organização este valor anual.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#15803D]">Potencial de poupança</p>
            <p className="mt-2 text-3xl font-extrabold text-[#15803D]" data-testid="savings">
              {fmtEur(stats.savings)} / ano
            </p>
            <p className="mt-2 text-sm text-gray-700">
              Programas estruturados de bem-estar reduzem este custo em até{" "}
              <strong>{Math.round(BENEFIT_REDUCTION * 100)}%</strong>.
            </p>
          </div>

          <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-700">ROI estimado</p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900" data-testid="roi">
              €{stats.roi} <span className="text-base font-normal text-gray-500">por cada €1 investido</span>
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Mediana de estudos publicados pela EU-OSHA. Resultados reais variam por setor e cultura organizacional.
            </p>
          </div>

          {/* CTA */}
          <Link
            href={proposalLink}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#15803D] px-6 py-4 text-base font-bold text-white shadow-lg hover:bg-[#0e6c33]"
            data-testid="cta-proposta"
          >
            Pedir proposta personalizada
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-center text-xs text-gray-500">
            Pré-preenchemos o formulário com os seus dados.
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="container mx-auto px-4 text-center text-xs text-gray-500">
          Fonte: EU-OSHA · OIT (Organização Internacional do Trabalho) · Modelo conservador.
        </div>
      </footer>
    </div>
  );
}
