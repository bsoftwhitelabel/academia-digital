"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Loader2, Mail } from "lucide-react";

export function SurveyTrainerClient({
  trainingActionId,
  sessionId,
  courseName,
  questionnaires,
  traineeCount,
}: {
  trainingActionId: string;
  sessionId: string;
  courseName: string;
  questionnaires: Array<{ id: string; name: string }>;
  traineeCount: number;
}) {
  const [questionnaireId, setQuestionnaireId] = useState(questionnaires[0]?.id ?? "");
  const [busy, setBusy] = useState<null | "shared" | "per">(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ url: string; image: string; total: number } | null>(null);

  const generate = async (mode: "shared" | "per") => {
    if (!questionnaireId) { setError("Escolhe um questionário"); return; }
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(`/api/survey/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingActionId, questionnaireId,
          mode: mode === "shared" ? "shared" : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Erro ${res.status}`);
        return;
      }
      setQr({ url: j.url, image: j.qrCodeBase64, total: j.total });
    } catch {
      setError("Erro de ligação");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Questionário de Satisfação</h1>
        <p className="text-sm text-gray-600">{courseName}</p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Questionário</label>
            <select
              value={questionnaireId}
              onChange={(e) => setQuestionnaireId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              data-testid="survey-questionnaire-select"
            >
              <option value="">— escolher —</option>
              {questionnaires.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => generate("shared")}
              disabled={busy !== null || !questionnaireId}
              className="bg-[#0B2447] hover:bg-[#153460]"
              data-testid="gen-shared"
            >
              {busy === "shared" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A gerar…</> :
                <><QrCode className="mr-2 h-4 w-4" />Gerar QR partilhado para a turma</>}
            </Button>
            <Button
              variant="outline"
              onClick={() => generate("per")}
              disabled={busy !== null || !questionnaireId}
              data-testid="gen-per"
            >
              {busy === "per" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A gerar…</> :
                <><Mail className="mr-2 h-4 w-4" />Gerar link único por formando ({traineeCount})</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {qr && (
        <Card data-testid="qr-display">
          <CardHeader>
            <CardTitle className="text-lg text-[#0B2447]">
              {qr.total === 1 ? "QR Code para projetar" : `${qr.total} links gerados`}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <img
              src={qr.image}
              alt="QR Code"
              className="mx-auto h-72 w-72 rounded-lg border bg-white p-4 shadow"
            />
            <p className="mt-3 break-all text-xs text-gray-500">{qr.url}</p>
            <p className="mt-2 text-sm text-gray-700">Aponte a câmara do telemóvel para responder ao questionário</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
