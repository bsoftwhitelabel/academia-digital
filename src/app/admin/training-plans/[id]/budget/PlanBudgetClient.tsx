"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingDown, TrendingUp, Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import Link from "next/link";

type Monthly = { month: string; budgeted: number; spent: number };
type ActionRow = { id: string; name: string; code: string; budgeted: number; spent: number };

function fmtEur(n: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function monthLabel(key: string): string {
  const m = parseInt(key.split("-")[1], 10);
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m - 1] || key;
}

export function PlanBudgetClient({
  planId, planName, planYear, totalBudget, totalSpent, monthly, actions,
}: {
  planId: string;
  planName: string;
  planYear: number;
  totalBudget: number;
  totalSpent: number;
  monthly: Monthly[];
  actions: ActionRow[];
}) {
  const desvio = totalSpent - totalBudget;
  const desvioPct = totalBudget > 0 ? (desvio / totalBudget) * 100 : 0;
  const usagePct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const barColor = usagePct > 100 ? "bg-red-600" : usagePct >= 80 ? "bg-amber-500" : "bg-green-600";

  const chartData = monthly.map((m) => ({
    name: monthLabel(m.month),
    Orçado: Math.round(m.budgeted * 100) / 100,
    Gasto: Math.round(m.spent * 100) / 100,
  }));

  return (
    <div className="space-y-6" data-testid="plan-budget-page">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/training-plans"
            className="text-xs font-medium text-gray-500 hover:text-[#0B2447]"
          >
            ← Voltar a planos
          </Link>
          <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">
            Orçamento — {planName}
          </h1>
          <p className="text-sm text-gray-600">Ano {planYear}</p>
        </div>
        <a
          href={`/api/admin/training-plans/${planId}/budget/export`}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0B2447] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B2447]/90"
          data-testid="export-budget-pdf"
        >
          <Download className="h-4 w-4" />
          Exportar relatório (PDF)
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card data-testid="kpi-budgeted">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Orçado</CardTitle>
            <Wallet className="h-4 w-4 text-[#0B2447]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0B2447]" data-testid="total-budget">
              {fmtEur(totalBudget)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-spent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Gasto</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700" data-testid="total-spent">
              {fmtEur(totalSpent)}
            </div>
            <p className="mt-1 text-xs text-gray-500">{usagePct.toFixed(1)}% do orçamento</p>
          </CardContent>
        </Card>

        <Card data-testid="kpi-desvio">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Desvio</CardTitle>
            <TrendingDown className={`h-4 w-4 ${desvio > 0 ? "text-red-600" : "text-green-600"}`} />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${desvio > 0 ? "text-red-700" : "text-green-700"}`}
              data-testid="desvio-value"
            >
              {desvio >= 0 ? "+" : ""}{fmtEur(desvio)}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {desvioPct >= 0 ? "+" : ""}{desvioPct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progresso global */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Execução orçamental</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
              data-testid="global-progress"
            />
          </div>
          <p className="mt-2 text-xs text-gray-600">
            {fmtEur(totalSpent)} de {fmtEur(totalBudget)} ({usagePct.toFixed(1)}%)
          </p>
        </CardContent>
      </Card>

      {/* Gráfico mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Orçado vs. gasto por mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full" data-testid="monthly-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(v: any) => fmtEur(Number(v) || 0)} />
                <Legend />
                <Bar dataKey="Orçado" fill="#0B2447" />
                <Bar dataKey="Gasto" fill="#C9A520" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de ações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ações de formação</CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-sm text-gray-500">Sem ações registadas neste plano.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="actions-table">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="pb-2">Código</th>
                    <th className="pb-2">Ação</th>
                    <th className="pb-2 text-right">Orçado</th>
                    <th className="pb-2 text-right">Gasto</th>
                    <th className="pb-2 text-right">Desvio</th>
                    <th className="pb-2 text-right">%</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => {
                    const dv = a.spent - a.budgeted;
                    const pct = a.budgeted > 0 ? (a.spent / a.budgeted) * 100 : 0;
                    return (
                      <tr key={a.id} className="border-b last:border-0" data-testid={`action-row-${a.id}`}>
                        <td className="py-2 font-mono text-xs">{a.code}</td>
                        <td className="py-2">{a.name}</td>
                        <td className="py-2 text-right">{fmtEur(a.budgeted)}</td>
                        <td className="py-2 text-right">{fmtEur(a.spent)}</td>
                        <td
                          className={`py-2 text-right font-medium ${
                            dv > 0 ? "text-red-700" : dv < 0 ? "text-green-700" : "text-gray-700"
                          }`}
                        >
                          {dv >= 0 ? "+" : ""}{fmtEur(dv)}
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                              pct > 100
                                ? "bg-red-100 text-red-700"
                                : pct >= 80
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {pct.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <Link
                            href={`/admin/actions/${a.id}/costs`}
                            className="text-xs font-semibold text-[#0B2447] hover:underline"
                          >
                            Detalhes →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
