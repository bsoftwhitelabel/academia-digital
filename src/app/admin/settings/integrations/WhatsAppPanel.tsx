"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send } from "lucide-react";

type Initial = {
  enabled: boolean;
  accountSidMasked: string;
  authTokenMasked: string;
  fromNumber: string;
  events: Record<string, boolean>;
};

const EVENT_KEYS: Array<{ key: string; label: string }> = [
  { key: "SESSION_REMINDER", label: "Lembrete de sessão" },
  { key: "SIGNATURE_ENABLED", label: "Assinatura disponível" },
  { key: "CERTIFICATE_ISSUED", label: "Certificado emitido" },
  { key: "QUESTIONNAIRE_AVAILABLE", label: "Link de questionário" },
];

export function WhatsAppPanel({ initial }: { initial: Initial }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [accountSid, setAccountSid] = useState(""); // novo valor (empty = manter)
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState(initial.fromNumber);
  const [events, setEvents] = useState<Record<string, boolean>>(
    Object.fromEntries(EVENT_KEYS.map((e) => [e.key, initial.events[e.key] !== false]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const save = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/tenant/integrations/whatsapp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled, accountSid, authToken, fromNumber, events,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg({ type: "err", text: j.error || `Erro ${res.status}` });
        return;
      }
      setAccountSid("");
      setAuthToken("");
      setMsg({ type: "ok", text: "Configuração WhatsApp guardada." });
    } finally { setSubmitting(false); }
  };

  const test = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/integrations/whatsapp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: j.error || `Erro ${res.status}` });
        return;
      }
      setMsg({ type: "ok", text: `Teste enviado para ${j.sentTo}.` });
    } finally { setTesting(false); }
  };

  return (
    <Card data-testid="whatsapp-panel">
      <CardHeader>
        <CardTitle className="text-lg text-[#0B2447]">WhatsApp Business (Twilio)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <div className={`rounded p-2 text-sm border ${msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {msg.text}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="wp-enabled" />
          <Label>Integração ativa</Label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Account SID</Label>
            <Input
              placeholder={initial.accountSidMasked || "AC..."}
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              data-testid="wp-sid"
            />
          </div>
          <div>
            <Label>Auth Token</Label>
            <Input
              type="password"
              placeholder={initial.authTokenMasked || "••••"}
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              data-testid="wp-token"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Número From (whatsapp:+xxxxxxxxxxx)</Label>
            <Input
              placeholder="whatsapp:+14155238886"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              data-testid="wp-from"
            />
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="mb-3 text-sm font-medium text-gray-700">Eventos a notificar via WhatsApp</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EVENT_KEYS.map((e) => (
              <label key={e.key} className="flex items-center gap-3 rounded border border-gray-200 p-3">
                <Switch
                  checked={!!events[e.key]}
                  onCheckedChange={(v: boolean) => setEvents((p) => ({ ...p, [e.key]: v }))}
                  data-testid={`wp-event-${e.key}`}
                />
                <span className="text-sm text-gray-700">{e.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={save} disabled={submitting}
            className="bg-[#0B2447] hover:bg-[#153460]"
            data-testid="wp-save"
          >
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A guardar…</> : "Guardar"}
          </Button>
          <Button variant="outline" onClick={test} disabled={testing} data-testid="wp-test">
            {testing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A enviar…</> : <><Send className="mr-2 h-4 w-4" />Testar ligação</>}
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          Modo de desenvolvimento: sem TWILIO_ACCOUNT_SID definido em .env, as mensagens
          são registadas no console em vez de enviadas.
        </p>
      </CardContent>
    </Card>
  );
}
