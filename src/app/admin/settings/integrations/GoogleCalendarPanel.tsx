"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export function GoogleCalendarPanel({
  enabled, gcalQuery,
}: {
  enabled: boolean;
  gcalQuery: { state: string | null; reason: string | null };
}) {
  const [loading, setLoading] = useState(false);

  function handleConnect() {
    setLoading(true);
    window.location.href = "/api/integrations/google/auth";
  }

  async function handleDisconnect() {
    if (!confirm("Tem a certeza que quer desligar o Google Calendar? As sessões deixarão de ser sincronizadas.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/google/disconnect", { method: "POST" });
      if (!res.ok) {
        alert("Erro ao desligar.");
        return;
      }
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card data-testid="gcal-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#0B2447]">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Conecte uma conta Google para que as sessões de formação sejam automaticamente
          adicionadas ao calendário primário da entidade.
        </p>

        {gcalQuery.state === "connected" && (
          <div className="flex items-start gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Google Calendar ligado com sucesso.</span>
          </div>
        )}
        {gcalQuery.state === "error" && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Erro ao ligar Google Calendar{gcalQuery.reason ? ` (${gcalQuery.reason})` : ""}.</span>
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3">
          <div>
            <div className="text-sm font-semibold text-[#0B2447]">Estado</div>
            <div className={`mt-1 text-sm ${enabled ? "text-green-700" : "text-gray-500"}`} data-testid="gcal-status">
              {enabled ? "Ligado" : "Não ligado"}
            </div>
          </div>
          {enabled ? (
            <Button variant="outline" onClick={handleDisconnect} disabled={loading} data-testid="gcal-disconnect">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Desligar
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={loading} data-testid="gcal-connect">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
              Ligar Google Calendar
            </Button>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Ao ligar, autorizamos a criação/atualização/eliminação de eventos no calendário primário
          da conta Google selecionada. Pode revogar o acesso a qualquer momento.
        </p>
      </CardContent>
    </Card>
  );
}
