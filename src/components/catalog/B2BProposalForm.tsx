"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2, Building2 } from "lucide-react";
import { trackInquirySubmitted } from "./TrackableCard";

const EMP_RANGES = ["1-10", "10-50", "50-200", "200-500", "500+"] as const;
const FORMATOS = ["Presencial", "Online", "Híbrido"] as const;
const HOW_FOUND = [
  "Pesquisa Google",
  "LinkedIn",
  "Indicação de outra empresa",
  "Evento / Webinar",
  "Newsletter",
  "Outro",
];

export type WorkshopOption = { id: string; name: string };

export type B2BProposalFormProps = {
  tenantSlug: string;
  workshops: WorkshopOption[];
  // Pré-preenchimento opcional vindo da calculadora
  prefill?: {
    employees?: string;
    setor?: string;
    desafios?: string[];
    workshopIds?: string[];
  };
};

export function B2BProposalForm({ tenantSlug, workshops, prefill }: B2BProposalFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [nif, setNif] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [setor, setSetor] = useState(prefill?.setor || "");
  const [empRange, setEmpRange] = useState(
    prefill?.employees ? rangeFromCount(prefill.employees) : ""
  );
  const [selectedWorkshops, setSelectedWorkshops] = useState<Record<string, boolean>>(
    Object.fromEntries((prefill?.workshopIds || []).map((id) => [id, true]))
  );
  const [formato, setFormato] = useState<typeof FORMATOS[number]>("Presencial");
  const [preferredDate, setPreferredDate] = useState("");
  const [howFound, setHowFound] = useState("");
  const [message, setMessage] = useState(
    prefill?.desafios?.length ? `Desafios identificados: ${prefill.desafios.join(", ")}` : ""
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !company) {
      setError("Nome, apelido, email e empresa são obrigatórios.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const workshopIds = Object.entries(selectedWorkshops).filter(([, v]) => v).map(([k]) => k);
    const workshopNames = workshops
      .filter((w) => workshopIds.includes(w.id))
      .map((w) => w.name);

    // Construir mensagem rica para o comercial
    const richMessage = [
      message ? `Mensagem do prospect:\n${message}\n` : "",
      `--- Detalhes B2B ---`,
      `NIF: ${nif || "—"}`,
      `Setor: ${setor || "—"}`,
      `Nº colaboradores: ${empRange || "—"}`,
      `Formato preferido: ${formato}`,
      `Data preferida: ${preferredDate || "—"}`,
      `Como nos conheceu: ${howFound || "—"}`,
      workshopNames.length > 0 ? `\nWorkshops de interesse (${workshopNames.length}):\n - ${workshopNames.join("\n - ")}` : "",
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch(`/api/catalog/${tenantSlug}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, email, phone, company, jobTitle,
          courseId: workshopIds[0] || null,
          courseName: workshopNames.length === 1
            ? workshopNames[0]
            : `Pacote B2B (${workshopNames.length} workshops)`,
          message: richMessage,
          // Campos extras (aceites pela API atualizada)
          isB2B: true,
          nif, setor, empRange, formato, preferredDate, howFound,
          workshopIds,
          workshopNames,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Erro ${res.status}`);
        return;
      }
      trackInquirySubmitted({ courseSlug: null, tenantSlug, source: "b2b-proposal" });
      setSuccess(true);
    } catch {
      setError("Erro de ligação. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="border-emerald-200 bg-emerald-50" data-testid="b2b-success">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-14 w-14 text-[#15803D]" />
          <h3 className="text-xl font-bold text-[#15803D]">Pedido recebido!</h3>
          <p className="max-w-md text-gray-700">
            Recebemos o seu pedido de proposta para os workshops selecionados.
            A nossa equipa entrará em contacto em <strong>24 horas</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="b2b-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-[#15803D]">
          <Building2 className="h-5 w-5" />
          Pedido de Proposta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <Label>Apelido *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-semibold text-gray-700">Empresa</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Nome da empresa *</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} required data-testid="b2b-company" />
              </div>
              <div>
                <Label>NIF</Label>
                <Input value={nif} onChange={(e) => setNif(e.target.value)} data-testid="b2b-nif" />
              </div>
              <div>
                <Label>Setor de atividade</Label>
                <Input value={setor} onChange={(e) => setSetor(e.target.value)} data-testid="b2b-setor" />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Nº colaboradores</Label>
                <select
                  value={empRange}
                  onChange={(e) => setEmpRange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  data-testid="b2b-emp-range"
                >
                  <option value="">— escolher —</option>
                  {EMP_RANGES.map((r) => <option key={r} value={r}>{r} colaboradores</option>)}
                </select>
              </div>
            </div>
          </div>

          {workshops.length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-semibold text-gray-700">
                Workshops de interesse <span className="text-xs font-normal text-gray-500">({Object.values(selectedWorkshops).filter(Boolean).length} selecionados)</span>
              </p>
              <div className="max-h-64 overflow-y-auto rounded border border-gray-200 p-2">
                {workshops.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 rounded p-2 hover:bg-gray-50">
                    <Checkbox
                      checked={!!selectedWorkshops[w.id]}
                      onCheckedChange={(v: boolean) => setSelectedWorkshops((p) => ({ ...p, [w.id]: v }))}
                      data-testid={`b2b-ws-${w.id}`}
                    />
                    <span className="text-sm text-gray-700">{w.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Formato</Label>
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value as any)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                data-testid="b2b-formato"
              >
                {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label>Data preferida</Label>
              <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} data-testid="b2b-date" />
            </div>
            <div>
              <Label>Como nos conheceu</Label>
              <select
                value={howFound}
                onChange={(e) => setHowFound(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— escolher —</option>
                {HOW_FOUND.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Mensagem / Observações</Label>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Conte-nos mais sobre o desafio que está a enfrentar."
              data-testid="b2b-message"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#15803D] py-3 text-base font-bold text-white hover:bg-[#0e6c33]"
            data-testid="b2b-submit"
          >
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A enviar…</> : "Pedir proposta personalizada"}
          </Button>

          <p className="text-center text-xs text-gray-500">
            Resposta em 24 horas · Sem compromisso · Dados protegidos por RGPD.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function rangeFromCount(count: string): string {
  const n = Number(count);
  if (n <= 10) return "1-10";
  if (n <= 50) return "10-50";
  if (n <= 200) return "50-200";
  if (n <= 500) return "200-500";
  return "500+";
}
