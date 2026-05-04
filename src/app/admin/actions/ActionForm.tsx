"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Option = { id: string; label: string };

export type ActionDraft = {
  id?: string;
  courseId: string;
  clientOrgId?: string | null;
  planId?: string | null;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  format: "PRESENCIAL" | "ELEARNING" | "BLENDED";
  roomId?: string | null;
  actionCode?: string;
  financingSystem?: string | null;
  maxTrainees?: number | string | null;
  status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
};

export function ActionForm({
  initial,
  isNew,
  courses,
  clients,
  rooms,
  plans,
}: {
  initial: ActionDraft;
  isNew: boolean;
  courses: Option[];
  clients: Option[];
  rooms: Option[];
  plans: Option[];
}) {
  const router = useRouter();
  const [data, setData] = useState<ActionDraft>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ActionDraft>(k: K, v: ActionDraft[K]) =>
    setData((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!data.courseId || !data.startDate || !data.endDate) {
      setError("Curso, data início e data fim são obrigatórios.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = isNew
        ? await fetch(`/api/admin/actions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          })
        : await fetch(`/api/admin/actions/${data.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Erro ${res.status}`);
        return;
      }
      router.push("/admin/actions");
      router.refresh();
    } catch {
      setError("Erro de ligação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">
        {isNew ? "Nova Ação de Formação" : "Editar Ação"}
      </h1>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg text-[#0B2447]">Detalhes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Curso *</Label>
              <select className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={data.courseId}
                onChange={(e) => set("courseId", e.target.value)}>
                <option value="">— escolher curso —</option>
                {courses.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
              </select>
            </div>
            <div>
              <Label>Plano de Formação</Label>
              <select className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={data.planId ?? ""}
                onChange={(e) => set("planId", e.target.value || null)}>
                <option value="">— sem plano —</option>
                {plans.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
              </select>
            </div>
            <div>
              <Label>Entidade Cliente *</Label>
              <select className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={data.clientOrgId ?? ""}
                onChange={(e) => set("clientOrgId", e.target.value || null)}>
                <option value="">— escolher cliente —</option>
                {clients.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
              </select>
            </div>
            <div>
              <Label>Sala</Label>
              <select className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={data.roomId ?? ""}
                onChange={(e) => set("roomId", e.target.value || null)}>
                <option value="">— sem sala —</option>
                {rooms.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
              </select>
            </div>
            <div>
              <Label>Data início *</Label>
              <Input type="date" value={data.startDate}
                onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div>
              <Label>Data fim *</Label>
              <Input type="date" value={data.endDate}
                onChange={(e) => set("endDate", e.target.value)} />
            </div>
            <div>
              <Label>Modalidade</Label>
              <select className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={data.format}
                onChange={(e) => set("format", e.target.value as any)}>
                <option value="PRESENCIAL">Presencial</option>
                <option value="ELEARNING">E-learning</option>
                <option value="BLENDED">Blended</option>
              </select>
            </div>
            <div>
              <Label>Sistema de Financiamento</Label>
              <select className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={data.financingSystem ?? ""}
                onChange={(e) => set("financingSystem", e.target.value || null)}>
                <option value="">— nenhum —</option>
                <option value="POPH">POPH</option>
                <option value="PORNORTE">PORNORTE</option>
                <option value="FSE2020">FSE2020</option>
                <option value="PT2030">PT2030</option>
                <option value="PRR">PRR</option>
                <option value="PRIVATE">Privado</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div>
              <Label>Máx. Formandos</Label>
              <Input type="number" value={data.maxTrainees ?? ""}
                onChange={(e) => set("maxTrainees", e.target.value)} />
            </div>
            <div>
              <Label>Código da Ação</Label>
              <Input value={data.actionCode ?? ""}
                onChange={(e) => set("actionCode", e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={submit} disabled={submitting} className="bg-[#0B2447] hover:bg-[#153460]">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
