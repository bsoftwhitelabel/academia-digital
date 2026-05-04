"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, MessageCircle } from "lucide-react";

export function NotificationPrefs({
  initialEmail,
  initialWhatsApp,
  initialPhone,
}: {
  initialEmail: boolean;
  initialWhatsApp: boolean;
  initialPhone: string;
}) {
  const [notifEmail, setNotifEmail] = useState(initialEmail);
  const [notifWhatsApp, setNotifWhatsApp] = useState(initialWhatsApp);
  const [phone, setPhone] = useState(initialPhone);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const save = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/trainee/profile/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifEmail, notifWhatsApp, phone }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: j.error || `Erro ${res.status}` });
        return;
      }
      setMsg({ type: "ok", text: "Preferências guardadas." });
    } catch {
      setMsg({ type: "err", text: "Erro de ligação." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid="notif-prefs">
      <CardHeader>
        <CardTitle className="text-lg text-[#0B2447]">Notificações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <div className={`rounded p-2 text-sm border ${msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {msg.text}
          </div>
        )}

        <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-[#C9A520]" />
            <div>
              <p className="font-medium text-gray-800">Receber emails</p>
              <p className="text-xs text-gray-500">Lembretes, certificados, questionários por email.</p>
            </div>
          </div>
          <Switch
            checked={notifEmail}
            onCheckedChange={setNotifEmail}
            data-testid="pref-email"
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-[#C9A520]" />
            <div>
              <p className="font-medium text-gray-800">Receber mensagens WhatsApp</p>
              <p className="text-xs text-gray-500">Notificações instantâneas no telemóvel.</p>
            </div>
          </div>
          <Switch
            checked={notifWhatsApp}
            onCheckedChange={setNotifWhatsApp}
            data-testid="pref-whatsapp"
          />
        </label>

        <div>
          <Label htmlFor="pref-phone">Número de telemóvel</Label>
          <Input
            id="pref-phone"
            placeholder="+351 912 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="pref-phone"
          />
          <p className="mt-1 text-xs text-gray-500">
            Usado apenas para notificações da sua formação.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={save} disabled={submitting}
            className="bg-[#0B2447] hover:bg-[#153460]"
            data-testid="pref-save"
          >
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A guardar…</> : "Guardar preferências"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
