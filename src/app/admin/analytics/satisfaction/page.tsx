"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Star, Users, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#0B2447"];

type Period = "30d" | "90d" | "12m" | "all";

function periodToRange(p: Period): { from?: string; to?: string } {
  const now = new Date();
  if (p === "all") return {};
  const days = p === "30d" ? 30 : p === "90d" ? 90 : 365;
  const from = new Date(now.getTime() - days * 86400000);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export default function SatisfactionPage() {
  const [period, setPeriod] = useState<Period>("90d");
  const range = periodToRange(period);
  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (range.from) sp.set("from", range.from);
    if (range.to) sp.set("to", range.to);
    return sp.toString();
  }, [range.from, range.to]);

  const { data, error, isLoading } = useSWR(`/api/admin/analytics/satisfaction${qs ? `?${qs}` : ""}`, fetcher);

  if (error) return <p className="text-red-600">Erro ao carregar dados.</p>;
  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A520]" />A carregar…
      </div>
    );
  }

  const hasAlerts =
    (data.trainerAlerts?.length || 0) > 0 ||
    data.responseRateAlert ||
    (data.staleActions?.length || 0) > 0 ||
    (data.courseAlerts?.length || 0) > 0;

  return (
    <div className="space-y-6" data-testid="satisfaction-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Satisfação</h1>
          <p className="text-sm text-gray-600">Análise das respostas a questionários de satisfação.</p>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="period-filter">
          {(["30d", "90d", "12m", "all"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
              data-testid={`period-${p}`}
            >
              {p === "30d" ? "30 dias" : p === "90d" ? "90 dias" : p === "12m" ? "12 meses" : "Tudo"}
            </Button>
          ))}
        </div>
      </div>

      {/* Alert cards */}
      {hasAlerts && (
        <div className="space-y-3" data-testid="alerts-section">
          {data.responseRateAlert && (
            <Card className="border-amber-300 bg-amber-50" data-testid="alert-response-rate">
              <CardContent className="flex items-start gap-3 pt-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold text-amber-900">Taxa de resposta abaixo de 50%</p>
                  <p className="text-sm text-amber-800">
                    Apenas {data.responseRate}% dos questionários enviados foram respondidos. Considere ajustar
                    os lembretes ou simplificar o formulário.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {(data.trainerAlerts?.length || 0) > 0 && (
            <Card className="border-red-300 bg-red-50" data-testid="alert-trainers">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-900">
                      {data.trainerAlerts.length} formador(es) com média &lt; 3.5
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-red-800">
                      {data.trainerAlerts.map((t: any) => (
                        <li key={t.trainerId} className="flex justify-between">
                          <span>{t.name}</span>
                          <span className="font-bold">{t.average.toFixed(2)} ({t.count} resp.)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(data.staleActions?.length || 0) > 0 && (
            <Card className="border-blue-300 bg-blue-50" data-testid="alert-stale">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900">
                      {data.staleActions.length} ação(ões) concluída(s) sem respostas há &gt; 7 dias
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-blue-800">
                      {data.staleActions.slice(0, 5).map((a: any) => (
                        <li key={a.id} className="flex justify-between">
                          <span>{a.code} — {a.name}</span>
                          <span className="text-xs">há {a.daysSince}d</span>
                        </li>
                      ))}
                      {data.staleActions.length > 5 && (
                        <li className="text-xs italic">… +{data.staleActions.length - 5}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Satisfação média</CardTitle>
            <Star className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#0B2447]" data-testid="kpi-avg">
              {data.globalAverage.toFixed(2)} <span className="text-base text-gray-400">/ 5</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Respostas recebidas</CardTitle>
            <Users className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#0B2447]">{data.totalResponded}</div>
            <p className="mt-1 text-xs text-gray-500">de {data.totalGenerated} geradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Taxa de resposta</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${data.responseRate < 50 ? "text-amber-600" : "text-[#0B2447]"}`}>
              {data.responseRate}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Melhor formador</CardTitle>
            <Star className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent>
            {data.bestTrainer ? (
              <>
                <div className="text-base font-semibold text-[#0B2447]">{data.bestTrainer.name}</div>
                <p className="text-sm text-gray-600">{data.bestTrainer.average.toFixed(2)} / 5 ({data.bestTrainer.count} respostas)</p>
              </>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trainer ranking (horizontal) + Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg text-[#0B2447]">Ranking de formadores</CardTitle></CardHeader>
          <CardContent style={{ height: Math.max(280, 40 * (data.trainerRanking?.length || 1) + 40) }}>
            {data.trainerRanking.length === 0 ? (
              <p className="text-center text-sm text-gray-500">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trainerRanking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="average" fill="#0B2447" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg text-[#0B2447]">Distribuição de notas</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {data.distribution.every((d: any) => d.count === 0) ? (
              <p className="text-center text-sm text-gray-500">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.distribution} dataKey="count" nameKey="score" innerRadius={50} outerRadius={90}
                    label={(e: any) => e.score}>
                    {data.distribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly evolution (12 weeks) */}
      <Card>
        <CardHeader><CardTitle className="text-lg text-[#0B2447]">Evolução semanal (12 semanas)</CardTitle></CardHeader>
        <CardContent style={{ height: 240 }}>
          {!data.weeklyTrend || data.weeklyTrend.length === 0 ? (
            <p className="text-center text-sm text-gray-500">Sem dados suficientes.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="average" stroke="#C9A520" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {data.courseAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Cursos abaixo de 3.5 ({data.courseAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-red-700">
                  <th className="px-2 py-1">Curso</th>
                  <th className="px-2 py-1">Média</th>
                  <th className="px-2 py-1">Respostas</th>
                </tr>
              </thead>
              <tbody>
                {data.courseAlerts.map((c: any) => (
                  <tr key={c.courseId} className="border-b last:border-0">
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1 font-bold text-red-700">{c.average.toFixed(2)}</td>
                    <td className="px-2 py-1">{c.responses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
