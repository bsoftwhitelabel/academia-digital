"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";

type Question = {
  id: string;
  text: string;
  type: string; // SCALE | TEXT | BOOLEAN
  scaleMin: number;
  scaleMax: number;
  isRequired: boolean;
};

const SCALE_LABELS: Record<number, string> = {
  1: "Insuficiente",
  2: "Suficiente",
  3: "Bom",
  4: "Muito Bom",
  5: "Excelente",
};

export function SurveyWizard({
  token,
  title,
  courseName,
  tenantName,
  tenantLogoUrl,
  primaryColor,
  accentColor,
  questions,
}: {
  token: string;
  title: string;
  courseName: string | null;
  tenantName: string;
  tenantLogoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  questions: Question[];
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { scaleValue?: number; textValue?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const total = questions.length;
  const q = questions[step];
  const progress = total > 0 ? Math.round(((step + 1) / total) * 100) : 0;

  const setAnswer = (qid: string, patch: Partial<{ scaleValue: number; textValue: string }>) => {
    setAnswers((p) => ({ ...p, [qid]: { ...p[qid], ...patch } }));
  };

  const isAnswered = (qq: Question) => {
    if (!qq.isRequired) return true;
    const a = answers[qq.id];
    if (!a) return false;
    if (qq.type === "SCALE") return typeof a.scaleValue === "number";
    if (qq.type === "BOOLEAN") return a.textValue === "true" || a.textValue === "false";
    return !!a.textValue?.trim();
  };

  const canNext = q ? isAnswered(q) : false;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: questions.map((qq) => {
          const a = answers[qq.id] || {};
          return {
            questionId: qq.id,
            scaleValue: a.scaleValue ?? null,
            textValue: a.textValue ?? null,
          };
        }),
      };
      const res = await fetch(`/api/survey/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Erro ${res.status}`);
        return;
      }
      setDone(true);
    } catch {
      setError("Erro de ligação. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow border border-gray-200">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Obrigado!</h1>
          <p className="mt-2 text-sm text-gray-600">
            A sua avaliação foi registada com sucesso. Pode fechar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      {/* Header */}
      <header
        className="flex items-center justify-center gap-3 px-4 py-4 text-white shadow"
        style={{ background: primaryColor }}
      >
        {tenantLogoUrl ? (
          <img src={tenantLogoUrl} alt={tenantName} className="h-9 max-w-[140px] object-contain" />
        ) : (
          <span className="text-lg font-bold">{tenantName}</span>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-5">
        <div className="mb-2 text-center">
          <h1 className="text-lg font-bold text-[#0B2447]">{title}</h1>
          {courseName && (
            <p className="mt-1 text-xs uppercase tracking-wider" style={{ color: accentColor }}>
              {courseName}
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="my-3">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span data-testid="survey-step">Pergunta {step + 1} de {total}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full transition-all"
              style={{ width: `${progress}%`, background: accentColor }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {q && (
          <div className="rounded-lg bg-white p-5 shadow border border-gray-200" data-testid="survey-question">
            <h2 className="text-base font-semibold text-[#0B2447]">{q.text}</h2>
            {q.isRequired && <span className="mt-1 inline-block text-xs text-red-500">* Obrigatório</span>}

            {q.type === "SCALE" && (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5" data-testid="scale-buttons">
                {Array.from({ length: q.scaleMax - q.scaleMin + 1 }, (_, i) => i + q.scaleMin).map((n) => {
                  const active = answers[q.id]?.scaleValue === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setAnswer(q.id, { scaleValue: n })}
                      data-testid={`scale-${n}`}
                      className={`rounded-lg border-2 px-3 py-3 text-center transition-all ${
                        active ? "scale-105 shadow-md" : "border-gray-200 hover:border-gray-400"
                      }`}
                      style={{
                        borderColor: active ? primaryColor : undefined,
                        background: active ? primaryColor : "#fff",
                        color: active ? "#fff" : "#1a1a1a",
                      }}
                    >
                      <div className="text-2xl font-bold">{n}</div>
                      {SCALE_LABELS[n] && (
                        <div className="mt-0.5 text-[10px] uppercase tracking-wider opacity-80">
                          {SCALE_LABELS[n]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "BOOLEAN" && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["true", "false"] as const).map((v) => {
                  const active = answers[q.id]?.textValue === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setAnswer(q.id, { textValue: v })}
                      data-testid={`bool-${v}`}
                      className={`rounded-lg border-2 px-4 py-4 text-base font-semibold transition-all ${
                        active ? "scale-105 shadow-md" : "border-gray-200 hover:border-gray-400"
                      }`}
                      style={{
                        borderColor: active ? primaryColor : undefined,
                        background: active ? primaryColor : "#fff",
                        color: active ? "#fff" : "#1a1a1a",
                      }}
                    >
                      {v === "true" ? "Sim" : "Não"}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "TEXT" && (
              <Textarea
                rows={5}
                placeholder="Escreva aqui o seu comentário..."
                value={answers[q.id]?.textValue ?? ""}
                onChange={(e) => setAnswer(q.id, { textValue: e.target.value })}
                className="mt-4"
                data-testid="text-input"
              />
            )}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-5">
          <Button
            variant="outline"
            disabled={step === 0 || submitting}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex-1"
            data-testid="btn-prev"
          >
            Anterior
          </Button>
          {step < total - 1 ? (
            <Button
              disabled={!canNext || submitting}
              onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              className="flex-1"
              style={{ background: primaryColor }}
              data-testid="btn-next"
            >
              Seguinte
            </Button>
          ) : (
            <Button
              disabled={!canNext || submitting}
              onClick={submit}
              className="flex-1"
              style={{ background: accentColor, color: primaryColor, fontWeight: 700 }}
              data-testid="btn-submit"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A enviar…</>
              ) : (
                "Submeter"
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
