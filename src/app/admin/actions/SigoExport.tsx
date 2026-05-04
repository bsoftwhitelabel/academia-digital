"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, FileCode } from "lucide-react";

export type ActionOption = {
  id: string;
  label: string;
  code: string;
  enrollments: number;
};

export function SigoExport({ actions }: { actions: ActionOption[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pickTrainees, setPickTrainees] = useState<string>("");
  const [busy, setBusy] = useState<null | "actions" | "trainees">(null);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const downloadXml = async (kind: "actions" | "trainees") => {
    setBusy(kind);
    setError(null);
    try {
      let url = "";
      if (kind === "actions") {
        if (selectedIds.length === 0) {
          setError("Seleciona pelo menos uma ação.");
          return;
        }
        url = `/api/admin/sigo?type=ACTIONS&actionIds=${encodeURIComponent(selectedIds.join(","))}`;
      } else {
        if (!pickTrainees) {
          setError("Escolhe a ação para exportar formandos.");
          return;
        }
        url = `/api/admin/sigo?type=TRAINEES&actionId=${encodeURIComponent(pickTrainees)}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        setError(`Erro ${res.status}: ${t.slice(0, 100)}`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] || `SIGO-${kind}.xml`;
      const a = document.createElement("a");
      const obj = URL.createObjectURL(blob);
      a.href = obj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(obj);
    } catch (e: any) {
      setError(e?.message || "Erro de ligação");
    } finally {
      setBusy(null);
    }
  };

  const allSelected = actions.length > 0 && actions.every((a) => selected[a.id]);
  const toggleAll = () => {
    if (allSelected) setSelected({});
    else setSelected(Object.fromEntries(actions.map((a) => [a.id, true])));
  };

  return (
    <Card data-testid="sigo-panel">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[#0B2447]">
            <FileCode className="mr-2 inline-block h-5 w-5 text-[#C9A520]" />
            Exportar SIGO (DGERT)
          </CardTitle>
          <span className="text-xs text-gray-500">
            {selectedIds.length} de {actions.length} ações selecionadas
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded bg-red-50 p-2 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Ações para exportar
            </label>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-blue-600 hover:underline"
            >
              {allSelected ? "Desmarcar todas" : "Marcar todas"}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto rounded border border-gray-200">
            {actions.length === 0 ? (
              <p className="p-3 text-center text-sm text-gray-500">Sem ações.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {actions.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Checkbox
                      checked={!!selected[a.id]}
                      onCheckedChange={(v: boolean) =>
                        setSelected((p) => ({ ...p, [a.id]: v }))
                      }
                      data-testid={`sigo-action-${a.id}`}
                    />
                    <span className="font-mono text-xs text-gray-500 w-24">{a.code}</span>
                    <span className="flex-1 truncate">{a.label}</span>
                    <span className="text-xs text-gray-400">{a.enrollments} formandos</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => downloadXml("actions")}
            disabled={busy !== null || selectedIds.length === 0}
            className="bg-[#0B2447] hover:bg-[#153460]"
            data-testid="sigo-export-actions"
          >
            {busy === "actions" ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A gerar…</>
            ) : (
              <><Download className="mr-2 h-4 w-4" />Exportar Ações Selecionadas</>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <select
              value={pickTrainees}
              onChange={(e) => setPickTrainees(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              data-testid="sigo-trainees-select"
            >
              <option value="">— ação para formandos —</option>
              {actions.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.label}</option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => downloadXml("trainees")}
              disabled={busy !== null || !pickTrainees}
              data-testid="sigo-export-trainees"
            >
              {busy === "trainees" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A gerar…</>
              ) : (
                <><Download className="mr-2 h-4 w-4" />Exportar Formandos</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
