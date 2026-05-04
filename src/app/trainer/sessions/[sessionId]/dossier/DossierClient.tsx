"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  SignaturePadInput,
  type SignaturePadInputHandle,
} from "@/components/signature/SignaturePadInput";
import { Loader2, Plus, Trash2, CheckCircle2 } from "lucide-react";

const DIDACTIC_RESOURCES = [
  "Videoprojetor",
  "Computador",
  "Quadro",
  "Manual do Formando",
  "Testes",
  "Exercícios",
] as const;

type Occurrence = { description: string };

export default function DossierClient({
  sessionId,
  trainerName,
}: {
  sessionId: string;
  trainerName: string;
}) {
  const router = useRouter();

  const [resources, setResources] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DIDACTIC_RESOURCES.map((r) => [r, false]))
  );
  const [hasOccurrences, setHasOccurrences] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([
    { description: "" },
  ]);
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const trainerPadRef = useRef<SignaturePadInputHandle>(null);
  const occPadRefs = useRef<(SignaturePadInputHandle | null)[]>([]);

  // Reset refs array when occurrences count changes
  useEffect(() => {
    occPadRefs.current = occPadRefs.current.slice(0, occurrences.length);
  }, [occurrences.length]);

  const addOccurrence = () =>
    setOccurrences((prev) => [...prev, { description: "" }]);

  const removeOccurrence = (i: number) =>
    setOccurrences((prev) => prev.filter((_, idx) => idx !== i));

  const updateOccurrence = (i: number, value: string) =>
    setOccurrences((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, description: value } : o))
    );

  const handleSubmit = async () => {
    setError(null);
    const trainerSignatureUrl = trainerPadRef.current?.getDataUrl();
    if (!trainerSignatureUrl) {
      setError("Assinatura do formador é obrigatória.");
      return;
    }

    const occPayload = hasOccurrences
      ? occurrences
          .map((o, i) => {
            const desc = o.description.trim();
            if (!desc) return null;
            const respSig = occPadRefs.current[i]?.getDataUrl() || undefined;
            return { description: desc, responsibleSignatureUrl: respSig };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];

    if (hasOccurrences && occPayload.length === 0) {
      setError(
        'Indicou "Com ocorrências" mas não preencheu nenhuma descrição.'
      );
      return;
    }

    const didacticResources = Object.entries(resources)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/trainer/sessions/${sessionId}/dossier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          didacticResources,
          summary: summary.trim() || undefined,
          trainerSignatureUrl,
          occurrences: occPayload,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Erro ${res.status}`);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/trainer/sessions"), 1500);
    } catch {
      setError("Erro de ligação ao servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-[#0B2447]">
          Dossier guardado e assinado
        </h2>
        <p className="mt-2 text-sm text-gray-500">A redirecionar…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">
          Dossier da Sessão
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Registo de recursos didáticos, ocorrências e sumário desta sessão.
        </p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Recursos didáticos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">
            Recursos didáticos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DIDACTIC_RESOURCES.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              >
                <Checkbox
                  data-testid={`resource-${r}`}
                  checked={resources[r]}
                  onCheckedChange={(v: boolean) =>
                    setResources((prev) => ({ ...prev, [r]: v }))
                  }
                />
                <span className="text-sm font-medium text-gray-700">{r}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sumário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">Sumário</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Resumo dos conteúdos abordados nesta sessão (opcional)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            data-testid="summary"
          />
        </CardContent>
      </Card>

      {/* Ocorrências */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[#0B2447]">Ocorrências</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="occ-toggle" className="text-sm text-gray-600">
                Com ocorrências nesta sessão
              </Label>
              <Switch
                id="occ-toggle"
                checked={hasOccurrences}
                onCheckedChange={setHasOccurrences}
                data-testid="occ-toggle"
              />
            </div>
          </div>
        </CardHeader>
        {hasOccurrences && (
          <CardContent className="space-y-6">
            {occurrences.map((occ, i) => (
              <div
                key={i}
                className="space-y-3 rounded-md border border-gray-200 p-4"
                data-testid={`occ-block-${i}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Label htmlFor={`occ-desc-${i}`} className="text-sm font-medium">
                    Ocorrência #{i + 1} — Descrição
                  </Label>
                  {occurrences.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOccurrence(i)}
                      aria-label="Remover ocorrência"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
                <Textarea
                  id={`occ-desc-${i}`}
                  data-testid={`occ-desc-${i}`}
                  rows={3}
                  placeholder="Descreva a ocorrência…"
                  value={occ.description}
                  onChange={(e) => updateOccurrence(i, e.target.value)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500">
                      Assinatura do Formador
                    </p>
                    <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
                      Será preenchida com a assinatura principal abaixo.
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500">
                      Assinatura do Responsável
                    </p>
                    <SignaturePadInput
                      ref={(h) => {
                        occPadRefs.current[i] = h;
                      }}
                      height={120}
                      testId={`occ-sig-${i}`}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addOccurrence}
              className="gap-2"
              data-testid="occ-add"
            >
              <Plus className="h-4 w-4" />
              Adicionar ocorrência
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Assinatura do formador */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#0B2447]">
            Assinatura do Formador — {trainerName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignaturePadInput
            ref={trainerPadRef}
            height={200}
            testId="trainer-sig"
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="sticky bottom-20 flex justify-end md:bottom-4">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-[#0B2447] font-semibold text-white hover:bg-[#153460]"
          size="lg"
          data-testid="dossier-submit"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />A guardar…
            </>
          ) : (
            "Guardar e Assinar Dossier"
          )}
        </Button>
      </div>
    </div>
  );
}
