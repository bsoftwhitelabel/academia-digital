"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X } from "lucide-react";

type Item = {
  id: string;
  type: string;
  resourceId: string;
  resourceType: string;
  requestedAt: string;
  requestedBy: string;
  metadata: Record<string, any>;
};

const TYPE_LABELS: Record<string, string> = {
  ENROLLMENT: "Inscrição",
  TRAINING_PLAN: "Plano",
  TRAINING_ACTION: "Ação",
};

export function ApprovalsClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Item | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(
    () => ({
      ENROLLMENT: items.filter((i) => i.type === "ENROLLMENT"),
      TRAINING_PLAN: items.filter((i) => i.type === "TRAINING_PLAN"),
      TRAINING_ACTION: items.filter((i) => i.type === "TRAINING_ACTION"),
    }),
    [items]
  );

  const approve = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Erro ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const submitReject = async () => {
    if (!rejectFor || !rejectNotes.trim()) {
      setError("Notas obrigatórias.");
      return;
    }
    setBusy(rejectFor.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals/${rejectFor.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: rejectNotes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Erro ${res.status}`);
        return;
      }
      setRejectFor(null);
      setRejectNotes("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const renderTable = (rows: Item[]) =>
    rows.length === 0 ? (
      <p className="py-6 text-center text-sm text-gray-500">Sem pedidos pendentes.</p>
    ) : (
      <table className="w-full text-sm" data-testid="approvals-table">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-gray-500">
            <th className="px-2 py-2">Tipo</th>
            <th className="px-2 py-2">Recurso</th>
            <th className="px-2 py-2">Pedido por</th>
            <th className="px-2 py-2">Quando</th>
            <th className="px-2 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="px-2 py-2"><Badge>{TYPE_LABELS[r.type] || r.type}</Badge></td>
              <td className="px-2 py-2">
                {r.metadata?.courseName && <div className="font-semibold text-[#0B2447]">{r.metadata.courseName}</div>}
                {r.metadata?.traineeName && <div className="text-xs text-gray-600">{r.metadata.traineeName}</div>}
                {r.metadata?.planName && <div className="font-semibold text-[#0B2447]">{r.metadata.planName}</div>}
                {!r.metadata?.courseName && !r.metadata?.planName && (
                  <span className="font-mono text-xs text-gray-500">{r.resourceId.slice(0, 12)}…</span>
                )}
              </td>
              <td className="px-2 py-2 text-gray-700">{r.requestedBy}</td>
              <td className="px-2 py-2 text-xs text-gray-500">
                {new Date(r.requestedAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve(r.id)}
                    disabled={busy === r.id}
                    className="bg-green-600 text-white hover:bg-green-700"
                    data-testid={`approve-${r.id}`}
                  >
                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" />Aprovar</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setRejectFor(r); setRejectNotes(""); }}
                    disabled={busy === r.id}
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    data-testid={`reject-${r.id}`}
                  >
                    <X className="mr-1 h-4 w-4" />Rejeitar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Aprovações</h1>
          <p className="text-sm text-gray-600">{items.length} pedido(s) pendente(s).</p>
        </div>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg text-[#0B2447]">Pendentes</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="ENROLLMENT">
            <TabsList>
              <TabsTrigger value="ENROLLMENT">Inscrições <span className="ml-1 text-xs opacity-70">({groups.ENROLLMENT.length})</span></TabsTrigger>
              <TabsTrigger value="TRAINING_PLAN">Planos <span className="ml-1 text-xs opacity-70">({groups.TRAINING_PLAN.length})</span></TabsTrigger>
              <TabsTrigger value="TRAINING_ACTION">Ações <span className="ml-1 text-xs opacity-70">({groups.TRAINING_ACTION.length})</span></TabsTrigger>
            </TabsList>
            <TabsContent value="ENROLLMENT">{renderTable(groups.ENROLLMENT)}</TabsContent>
            <TabsContent value="TRAINING_PLAN">{renderTable(groups.TRAINING_PLAN)}</TabsContent>
            <TabsContent value="TRAINING_ACTION">{renderTable(groups.TRAINING_ACTION)}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar pedido</DialogTitle>
            <DialogDescription>Indique o motivo da rejeição (será notificado ao requerente).</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="Motivo da rejeição…"
            data-testid="reject-notes"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancelar</Button>
            <Button
              onClick={submitReject}
              disabled={!rejectNotes.trim() || !!busy}
              className="bg-red-600 text-white hover:bg-red-700"
              data-testid="confirm-reject"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
