"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileSpreadsheet, FileText, Eye } from "lucide-react";

type ReportType = "ENROLLMENTS" | "ATTENDANCE" | "SATISFACTION" | "BUDGET" | "TRAINERS_HOURS" | "CERTIFICATES";

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: "ENROLLMENTS", label: "Inscrições", description: "Lista de inscrições com formando, curso, cliente, estado." },
  { value: "ATTENDANCE", label: "Presenças", description: "Registo de presenças por sessão e formando." },
  { value: "SATISFACTION", label: "Satisfação", description: "Respostas a questionários com média por curso/ação." },
  { value: "BUDGET", label: "Orçamento", description: "Execução orçamental por ação (orçado vs gasto)." },
  { value: "TRAINERS_HOURS", label: "Horas formadores", description: "Total de horas e sessões por formador." },
  { value: "CERTIFICATES", label: "Certificados", description: "Certificados emitidos com formando, curso, código de verificação." },
];

const FILTERS_BY_TYPE: Record<ReportType, { course?: boolean; trainer?: boolean; clientOrg?: boolean; status?: boolean; date?: boolean }> = {
  ENROLLMENTS: { course: true, clientOrg: true, status: true, date: true },
  ATTENDANCE: { course: true, date: true },
  SATISFACTION: { date: true },
  BUDGET: { course: true, date: true },
  TRAINERS_HOURS: { trainer: true, date: true },
  CERTIFICATES: { date: true },
};

const ENROLLMENT_STATUSES = ["CONFIRMED", "PENDING_APPROVAL", "CANCELLED", "COMPLETED"];

export function ReportsClient({
  courses, trainers, clientOrgs,
}: {
  courses: { id: string; name: string }[];
  trainers: { id: string; name: string }[];
  clientOrgs: { id: string; name: string }[];
}) {
  const [type, setType] = useState<ReportType>("ENROLLMENTS");
  const [filters, setFilters] = useState<{ from?: string; to?: string; courseId?: string; trainerId?: string; clientOrgId?: string; status?: string }>({});
  const [preview, setPreview] = useState<{ title: string; columns: { key: string; label: string }[]; rows: any[] } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const cfg = FILTERS_BY_TYPE[type];

  function buildPayload(format: "json" | "xlsx" | "pdf") {
    const cleanedFilters: any = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v && v !== "") cleanedFilters[k] = v;
    }
    return { type, format, filters: cleanedFilters };
  }

  async function handlePreview() {
    setLoading("preview");
    try {
      const res = await fetch("/api/admin/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("json")),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(`Erro: ${e.error || res.statusText}`);
        return;
      }
      setPreview(await res.json());
    } finally {
      setLoading(null);
    }
  }

  async function handleExport(format: "xlsx" | "pdf") {
    setLoading(format);
    try {
      const res = await fetch("/api/admin/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(format)),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(`Erro: ${e.error || res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m?.[1] || `relatorio.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Relatórios</h1>
        <p className="text-sm text-gray-600">Construa relatórios ad hoc com filtros e exporte para Excel ou PDF.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1 · Tipo de relatório</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="report-types">
            {REPORT_TYPES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => { setType(r.value); setPreview(null); }}
                className={`rounded-lg border-2 p-4 text-left transition ${
                  type === r.value
                    ? "border-[#C9A520] bg-amber-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-[#0B2447]/30"
                }`}
                data-testid={`report-type-${r.value}`}
              >
                <div className="font-semibold text-[#0B2447]">{r.label}</div>
                <div className="mt-1 text-xs text-gray-600">{r.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2 · Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.date && (
              <>
                <div>
                  <Label htmlFor="from">De</Label>
                  <Input
                    id="from" type="date"
                    value={filters.from || ""}
                    onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                    data-testid="filter-from"
                  />
                </div>
                <div>
                  <Label htmlFor="to">Até</Label>
                  <Input
                    id="to" type="date"
                    value={filters.to || ""}
                    onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                    data-testid="filter-to"
                  />
                </div>
              </>
            )}
            {cfg.course && (
              <div>
                <Label htmlFor="courseId">Curso</Label>
                <select
                  id="courseId"
                  value={filters.courseId || ""}
                  onChange={(e) => setFilters({ ...filters, courseId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  data-testid="filter-course"
                >
                  <option value="">— Todos —</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {cfg.trainer && (
              <div>
                <Label htmlFor="trainerId">Formador</Label>
                <select
                  id="trainerId"
                  value={filters.trainerId || ""}
                  onChange={(e) => setFilters({ ...filters, trainerId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  data-testid="filter-trainer"
                >
                  <option value="">— Todos —</option>
                  {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {cfg.clientOrg && (
              <div>
                <Label htmlFor="clientOrgId">Cliente</Label>
                <select
                  id="clientOrgId"
                  value={filters.clientOrgId || ""}
                  onChange={(e) => setFilters({ ...filters, clientOrgId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  data-testid="filter-client"
                >
                  <option value="">— Todos —</option>
                  {clientOrgs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {cfg.status && (
              <div>
                <Label htmlFor="status">Estado</Label>
                <select
                  id="status"
                  value={filters.status || ""}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  data-testid="filter-status"
                >
                  <option value="">— Todos —</option>
                  {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3 · Gerar / Exportar</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePreview} disabled={!!loading} data-testid="btn-preview">
              {loading === "preview" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Pré-visualizar
            </Button>
            <Button
              onClick={() => handleExport("xlsx")}
              disabled={!!loading}
              variant="outline"
              data-testid="btn-export-xlsx"
            >
              {loading === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Exportar Excel
            </Button>
            <Button
              onClick={() => handleExport("pdf")}
              disabled={!!loading}
              variant="outline"
              data-testid="btn-export-pdf"
            >
              {loading === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Pré-visualização: {preview.title}</span>
              <span className="text-xs font-normal text-gray-500">{preview.rows.length} registo(s)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {preview.rows.length === 0 ? (
              <p className="text-sm text-gray-500">Sem dados para os filtros selecionados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="preview-table">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-gray-500">
                      {preview.columns.map((c) => <th key={c.key} className="pb-2 pr-3">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {preview.columns.map((c) => (
                          <td key={c.key} className="py-2 pr-3">{String(r[c.key] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 100 && (
                  <p className="mt-2 text-xs text-gray-500 italic">
                    A mostrar 100 de {preview.rows.length} registos. Exporte para ver todos.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
