"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";

type Cost = {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  invoiceRef: string | null;
};

const CATEGORIES = ["TRAINER", "ROOM", "MATERIALS", "OTHER"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  TRAINER: "Formador",
  ROOM: "Sala",
  MATERIALS: "Materiais",
  OTHER: "Outros",
};
const CATEGORY_COLORS: Record<string, string> = {
  TRAINER: "bg-blue-600",
  ROOM: "bg-purple-600",
  MATERIALS: "bg-amber-500",
  OTHER: "bg-gray-500",
};

function fmtEur(n: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

export function CostsClient({
  actionId, actionName, actionCode, clientName, initialBudget, initialSpent, initialCosts,
}: {
  actionId: string; actionName: string; actionCode: string; clientName: string | null;
  initialBudget: number; initialSpent: number; initialCosts: Cost[];
}) {
  const router = useRouter();
  const [costs, setCosts] = useState<Cost[]>(initialCosts);
  const [budget, setBudget] = useState(initialBudget);
  const [budgetEdit, setBudgetEdit] = useState(String(initialBudget));
  const [savingBudget, setSavingBudget] = useState(false);

  const [openAdd, setOpenAdd] = useState(false);
  const [newCost, setNewCost] = useState({
    description: "", category: "TRAINER", amount: "", date: new Date().toISOString().slice(0, 10), invoiceRef: "",
  });
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const spent = costs.reduce((s, c) => s + c.amount, 0);
    const byCat: Record<string, number> = {};
    for (const c of costs) byCat[c.category] = (byCat[c.category] || 0) + c.amount;
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    const desvio = spent - budget;
    return { spent, byCat, pct, desvio };
  }, [costs, budget]);

  const barColor = totals.pct > 100 ? "bg-red-600" : totals.pct >= 80 ? "bg-amber-500" : "bg-green-600";

  const saveBudget = async () => {
    setSavingBudget(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/actions/${actionId}/costs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetedAmount: Number(budgetEdit) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Erro ${res.status}`); return;
      }
      setBudget(Number(budgetEdit));
    } finally { setSavingBudget(false); }
  };

  const addCost = async () => {
    if (!newCost.description || !newCost.amount) {
      setError("Descrição e valor obrigatórios."); return;
    }
    setAdding(true); setError(null);
    try {
      const res = await fetch(`/api/admin/actions/${actionId}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newCost, amount: Number(newCost.amount) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || `Erro ${res.status}`); return; }
      setCosts((p) => [
        { id: j.costId, ...newCost, amount: Number(newCost.amount), invoiceRef: newCost.invoiceRef || null },
        ...p,
      ]);
      setOpenAdd(false);
      setNewCost({ description: "", category: "TRAINER", amount: "", date: new Date().toISOString().slice(0, 10), invoiceRef: "" });
      router.refresh();
    } finally { setAdding(false); }
  };

  const deleteCost = async (id: string) => {
    if (!confirm("Eliminar este custo?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/actions/${actionId}/costs/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCosts((p) => p.filter((c) => c.id !== id));
        router.refresh();
      }
    } finally { setDeleting(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">
          <Wallet className="mr-2 inline-block h-6 w-6 text-[#C9A520]" />
          Gestão Orçamental — {actionName}
        </h1>
        <p className="text-sm text-gray-600">
          {actionCode}{clientName ? ` · ${clientName}` : ""}
        </p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>
      )}

      {/* Card topo: orçamento vs gasto */}
      <Card data-testid="budget-card">
        <CardHeader><CardTitle className="text-lg text-[#0B2447]">Visão Geral</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-xs uppercase text-gray-500">Orçamento</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number" step="100"
                  value={budgetEdit}
                  onChange={(e) => setBudgetEdit(e.target.value)}
                  className="font-mono"
                  data-testid="budget-input"
                />
                <Button onClick={saveBudget} disabled={savingBudget} size="sm" data-testid="budget-save">
                  {savingBudget ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
              <div className="mt-1 text-2xl font-bold text-[#0B2447]" data-testid="budget-value">{fmtEur(budget)}</div>
            </div>
            <div>
              <Label className="text-xs uppercase text-gray-500">Gasto Real</Label>
              <div className="text-3xl font-bold text-gray-900" data-testid="spent-value">{fmtEur(totals.spent)}</div>
              <p className="text-xs text-gray-500">soma automática dos custos</p>
            </div>
            <div>
              <Label className="text-xs uppercase text-gray-500">Desvio</Label>
              <div className={`text-3xl font-bold ${totals.desvio > 0 ? "text-red-600" : "text-green-600"}`}
                data-testid="desvio-value">
                {totals.desvio >= 0 ? "+" : ""}{fmtEur(totals.desvio)}
              </div>
              <p className="text-xs text-gray-500">{totals.pct.toFixed(0)}% do orçamento</p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-2">
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full transition-all ${barColor}`}
                style={{ width: `${Math.min(100, totals.pct)}%` }}
                data-testid="progress-bar"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {totals.pct < 80 ? "Dentro do orçamento" : totals.pct <= 100 ? "Atenção: próximo do limite" : "Excedido"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cards por categoria */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <Card key={cat} data-testid={`cat-${cat}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-gray-500">{CATEGORY_LABELS[cat]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-[#0B2447]">{fmtEur(totals.byCat[cat] || 0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de custos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-[#0B2447]">Custos Registados ({costs.length})</CardTitle>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#0B2447] hover:bg-[#153460]" data-testid="add-cost-btn">
                <Plus className="mr-1 h-4 w-4" />Adicionar Custo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Custo</DialogTitle>
                <DialogDescription>Adicionar uma despesa associada a esta ação.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Descrição *</Label>
                  <Input value={newCost.description}
                    onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                    data-testid="new-cost-desc" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <select
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      value={newCost.category}
                      onChange={(e) => setNewCost({ ...newCost, category: e.target.value })}
                      data-testid="new-cost-cat"
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Valor (€) *</Label>
                    <Input type="number" step="0.01" value={newCost.amount}
                      onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })}
                      data-testid="new-cost-amt" />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={newCost.date}
                      onChange={(e) => setNewCost({ ...newCost, date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Ref. fatura</Label>
                    <Input value={newCost.invoiceRef}
                      onChange={(e) => setNewCost({ ...newCost, invoiceRef: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
                <Button onClick={addCost} disabled={adding} className="bg-[#0B2447] hover:bg-[#153460]"
                  data-testid="confirm-add-cost">
                  {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {costs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem custos registados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="px-2 py-2">Descrição</th>
                  <th className="px-2 py-2">Categoria</th>
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2">Ref.</th>
                  <th className="px-2 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-2 py-2">{c.description}</td>
                    <td className="px-2 py-2">
                      <Badge className={`${CATEGORY_COLORS[c.category] || "bg-gray-400"} text-white hover:opacity-90`}>
                        {CATEGORY_LABELS[c.category] || c.category}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-600">{c.date}</td>
                    <td className="px-2 py-2 text-right font-mono">{fmtEur(c.amount)}</td>
                    <td className="px-2 py-2 text-xs text-gray-500">{c.invoiceRef || "—"}</td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        variant="ghost" size="icon-sm"
                        onClick={() => deleteCost(c.id)}
                        disabled={deleting === c.id}
                        data-testid={`del-cost-${c.id}`}
                      >
                        {deleting === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
