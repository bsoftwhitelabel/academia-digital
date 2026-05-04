"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Trainee = {
  id: string;
  name: string;
  company: string | null;
  checkInStatus: "CHECKED_IN" | "CHECKED_OUT" | "MANUAL" | "ABSENT";
  signatureStatus: "PENDING" | "ENABLED" | "SIGNED" | "REJECTED" | null;
  signatureId: string | null;
};

type EnableResponse = {
  sessionId: string;
  isClosed: boolean;
  trainees: Trainee[];
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

function StatusBadge({ status }: { status: Trainee["signatureStatus"] }) {
  if (status === "SIGNED") {
    return <Badge className="bg-green-600 text-white hover:bg-green-700">SIGNED</Badge>;
  }
  if (status === "ENABLED") {
    return <Badge className="bg-[#1566C0] text-white hover:bg-[#0B2447]">ENABLED</Badge>;
  }
  if (status === "REJECTED") {
    return <Badge className="bg-red-600 text-white hover:bg-red-700">REJECTED</Badge>;
  }
  return <Badge className="bg-gray-400 text-white hover:bg-gray-500">PENDING</Badge>;
}

export default function SignaturesPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const { data, error, isLoading, mutate } = useSWR<EnableResponse>(
    `/api/trainer/sessions/${sessionId}/signatures/enable`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const toggle = (id: string, v: boolean) =>
    setSelected((prev) => ({ ...prev, [id]: v }));

  const handleEnable = async () => {
    setErrMsg(null);
    setOkMsg(null);
    if (selectedIds.length === 0) {
      setErrMsg("Selecione pelo menos um formando.");
      return;
    }
    if (data?.isClosed && !reason.trim()) {
      setErrMsg("Justificação obrigatória para sessão encerrada.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trainer/sessions/${sessionId}/signatures/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeIds: selectedIds, reason: reason.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrMsg(d.error || `Erro ${res.status}`);
        return;
      }
      setOkMsg(`${d.enabled} assinatura(s) habilitada(s).`);
      setSelected({});
      mutate();
    } catch {
      setErrMsg("Erro de ligação ao servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[#0B2447]">Erro</h1>
        <p className="text-red-600">Não foi possível carregar a lista.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A520]" />
        A carregar formandos…
      </div>
    );
  }

  const eligibleCount = data.trainees.filter(
    (t) => t.signatureStatus !== "SIGNED"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">
          Habilitar Assinaturas
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Selecione os formandos com presença confirmada para habilitar a
          assinatura do registo de presenças.
          {data.isClosed && (
            <span className="ml-1 font-semibold text-red-600">
              (Sessão encerrada — justificação obrigatória)
            </span>
          )}
        </p>
      </div>

      {errMsg && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {errMsg}
        </div>
      )}
      {okMsg && (
        <div className="rounded bg-green-50 p-3 text-sm text-green-700 border border-green-200">
          {okMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg text-[#0B2447]">
              Formandos com presença
            </CardTitle>
            <span className="text-sm text-gray-500">
              {data.trainees.length} formandos · {eligibleCount} elegíveis
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {data.trainees.length === 0 ? (
            <p className="py-6 text-center text-gray-500">
              Nenhum formando com check-in confirmado nesta sessão.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.trainees.map((t) => {
                const isSigned = t.signatureStatus === "SIGNED";
                return (
                  <li
                    key={t.id}
                    data-testid={`sig-row-${t.id}`}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex items-center gap-3 sm:flex-1">
                      <Checkbox
                        data-testid={`sig-check-${t.id}`}
                        checked={!!selected[t.id]}
                        onCheckedChange={(v: boolean) => toggle(t.id, v)}
                        disabled={isSigned}
                        aria-label={`Selecionar ${t.name}`}
                      />
                      <Avatar size="lg">
                        <AvatarFallback className="bg-[#0B2447] text-white">
                          {initials(t.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#0B2447]">
                          {t.name}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {t.company || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <StatusBadge status={t.signatureStatus} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">
            Justificação{" "}
            {data.isClosed && <span className="text-red-600">*</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="reason" className="sr-only">
            Justificação
          </Label>
          <Textarea
            id="reason"
            data-testid="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={
              data.isClosed
                ? "Obrigatório: porque está a habilitar fora do prazo?"
                : "Opcional: nota visível no email enviado ao formando."
            }
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleEnable}
          disabled={submitting || selectedIds.length === 0}
          className="bg-[#0B2447] font-semibold text-white hover:bg-[#153460]"
          size="lg"
          data-testid="enable-submit"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />A habilitar…
            </>
          ) : (
            `Habilitar Selecionados (${selectedIds.length})`
          )}
        </Button>
      </div>
    </div>
  );
}
