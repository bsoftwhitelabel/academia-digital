"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";

export function EmailPanel({
  fromName,
  fromAddress,
  apiKeyMasked,
}: {
  fromName: string;
  fromAddress: string;
  apiKeyMasked: string;
}) {
  const [name, setName] = useState(fromName || "");
  const [addr, setAddr] = useState(fromAddress || "");
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const save = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/tenant/integrations/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromName: name, fromAddress: addr }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg({ type: "err", text: j.error || `Erro ${res.status}` });
        return;
      }
      setMsg({ type: "ok", text: "Configuração de email guardada." });
    } finally { setSubmitting(false); }
  };

  const test = async () => {
    setTesting(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/integrations/email/test`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: j.error || `Erro ${res.status}` });
        return;
      }
      setMsg({ type: "ok", text: `Teste enviado para ${j.sentTo}.` });
    } finally { setTesting(false); }
  };

  return (
    <Card data-testid="email-panel">
      <CardHeader>
        <CardTitle className="text-lg text-[#0B2447]">Email (Resend)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <div className={`rounded p-2 text-sm border ${msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {msg.text}
          </div>
        )}

        <div>
          <Label>API Key (RESEND_API_KEY)</Label>
          <code className="mt-1 block rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-700">
            {apiKeyMasked || "(não configurada)"}
          </code>
          <p className="mt-1 text-xs text-gray-500">
            Definida via variável de ambiente. Para alterar, edite o ficheiro .env do servidor.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Nome do remetente</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Academia Digital" data-testid="email-from-name" />
          </div>
          <div>
            <Label>Email do remetente</Label>
            <Input type="email" value={addr} onChange={(e) => setAddr(e.target.value)}
              placeholder="noreply@academiadigital.app" data-testid="email-from-addr" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={save} disabled={submitting}
            className="bg-[#0B2447] hover:bg-[#153460]"
            data-testid="email-save"
          >
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A guardar…</> : "Guardar"}
          </Button>
          <Button variant="outline" onClick={test} disabled={testing} data-testid="email-test">
            {testing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A enviar…</> : <><Send className="mr-2 h-4 w-4" />Testar</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
