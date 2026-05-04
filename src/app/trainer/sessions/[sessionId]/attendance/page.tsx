"use client";

import { useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, Users, UserCheck, AlertCircle } from "lucide-react";
import { QRCodeModalTrigger } from "@/components/trainer/QRCodeModal";

type Trainee = {
  id: string;
  name: string;
  company: string | null;
  status: "CHECKED_IN" | "CHECKED_OUT" | "ABSENT" | "MANUAL";
  checkedInAt: string | null;
  isManual: boolean;
};

type StatusResponse = {
  sessionId: string;
  isOpen: boolean;
  isClosed: boolean;
  total: number;
  present: number;
  absent: number;
  trainees: Trainee[];
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function formatTime(iso: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function AttendancePage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const { data, error, isLoading, mutate } = useSWR<StatusResponse>(
    `/api/checkin/${sessionId}/status`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const [filter, setFilter] = useState<"all" | "present" | "absent">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleManualCheckIn = async (traineeId: string) => {
    setBusyId(traineeId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/checkin/${sessionId}/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || `Erro ${res.status}`);
      }
      mutate();
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (traineeId: string) => {
    setBusyId(traineeId);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/checkin/${sessionId}/manual?traineeId=${traineeId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || `Erro ${res.status}`);
      }
      mutate();
    } finally {
      setBusyId(null);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/trainer/sessions/${sessionId}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || `Erro ${res.status}`);
        setClosing(false);
        return;
      }
      setConfirmClose(false);
      router.push("/trainer/sessions");
    } catch {
      setErrorMsg("Erro de ligação ao servidor.");
      setClosing(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
        <AlertCircle className="w-16 h-16 text-[var(--color-danger)] mb-4 opacity-20" />
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Erro de Conexão</h1>
        <p className="text-[var(--color-text-muted)] mt-2">Não foi possível carregar o estado da sessão.</p>
        <Button onClick={() => mutate()} variant="outline" className="mt-6 border-[var(--color-border)]">Tentar Novamente</Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--color-text-muted)] animate-in fade-in">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--color-primary-light)] mb-4" />
        <p className="font-medium">A carregar dados da sessão…</p>
      </div>
    );
  }

  const filtered = data.trainees.filter((t) => {
    if (filter === "present") return t.status !== "ABSENT";
    if (filter === "absent") return t.status === "ABSENT";
    return true;
  });

  const progress = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
  
  // Circular Progress calculations
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-[var(--color-surface-2)] p-6 rounded-2xl shadow-sm border border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-primary)] sm:text-3xl tracking-tight">
            Controlo de Presenças
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)] flex items-center gap-2">
            Acompanhamento em tempo real{" "}
            {data.isClosed && (
              <Badge variant="outline" className="bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)]">Sessão Encerrada</Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <QRCodeModalTrigger sessionId={sessionId} />
          {!data.isClosed && (
            <Button
              onClick={() => setConfirmClose(true)}
              data-testid="finalize-button"
              className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90 shadow-sm border-none font-semibold"
            >
              Finalizar Sessão
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-[var(--color-danger)]/10 p-4 text-sm text-[var(--color-danger)] border border-[var(--color-danger)]/20 flex items-center gap-3 font-medium">
          <AlertCircle className="w-5 h-5" />
          {errorMsg}
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Card contador Circular */}
        <Card className="lg:col-span-1 border-[var(--color-border)] shadow-sm bg-[var(--color-surface-2)] flex flex-col items-center justify-center p-6" data-testid="counter-card">
          <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-6 w-full text-center">Progresso da Turma</h3>
          <div className="relative flex items-center justify-center w-48 h-48">
             <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-[var(--color-surface)] fill-none"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-[var(--color-success)] fill-none transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
             </svg>
             <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-[var(--color-text)]">{data.present}</span>
                <span className="text-sm font-semibold text-[var(--color-text-muted)] mt-1">de {data.total}</span>
             </div>
          </div>
          <p className="mt-6 text-sm font-medium text-[var(--color-success)] bg-[var(--color-success)]/10 px-4 py-1.5 rounded-full">
            {progress}% presenças confirmadas
          </p>
        </Card>

        {/* Lista e Filtros */}
        <Card className="lg:col-span-2 border-[var(--color-border)] shadow-sm bg-[var(--color-surface-2)] flex flex-col">
          <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <CardTitle className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[var(--color-primary-light)]" />
                  Formandos
               </CardTitle>
               <div className="flex bg-[var(--color-surface)] p-1 rounded-lg border border-[var(--color-border)]">
                 <button
                   onClick={() => setFilter("all")}
                   className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === "all" ? "bg-[var(--color-surface-2)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                 >
                   Todos ({data.total})
                 </button>
                 <button
                   onClick={() => setFilter("present")}
                   className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === "present" ? "bg-[var(--color-success)] text-white shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-success)]"}`}
                 >
                   Presentes ({data.present})
                 </button>
                 <button
                   onClick={() => setFilter("absent")}
                   className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === "absent" ? "bg-[var(--color-danger)] text-white shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"}`}
                 >
                   Ausentes ({data.absent})
                 </button>
               </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-y-auto max-h-[500px]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--color-text-muted)]">
                 <UserCheck className="w-12 h-12 mb-4 opacity-20" />
                 <p className="font-medium">Sem formandos para mostrar nesta categoria.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {filtered.map((t) => {
                  const isPresent = t.status !== "ABSENT";
                  return (
                    <li
                      key={t.id}
                      data-testid={`trainee-row-${t.id}`}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--color-surface)]/30 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-[var(--color-border)]">
                          <AvatarFallback className="bg-[var(--color-primary)] text-white font-bold text-xs">
                            {initials(t.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary-light)] transition-colors">{t.name}</p>
                          <p className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                            {t.company ? (
                               <><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)]"></span> {t.company}</>
                            ) : "Sem entidade"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isPresent ? (
                          <>
                            <div className="flex items-center gap-2">
                               <Badge className="bg-[var(--color-success)]/10 text-[var(--color-success)] border-none hover:bg-[var(--color-success)]/20 px-2 py-1">
                                 <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                 {t.isManual ? "Manual" : "Presente"}
                               </Badge>
                               <span className="text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-1 rounded-md border border-[var(--color-border)] tabular-nums">
                                 {formatTime(t.checkedInAt)}
                               </span>
                            </div>
                            {!data.isClosed && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === t.id}
                                onClick={() => handleCancel(t.id)}
                                data-testid={`cancel-${t.id}`}
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                              >
                                {busyId === t.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Anular"
                                )}
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Badge className="bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] px-2 py-1">
                              Ausente
                            </Badge>
                            {!data.isClosed && (
                              <Button
                                size="sm"
                                disabled={busyId === t.id}
                                onClick={() => handleManualCheckIn(t.id)}
                                data-testid={`checkin-${t.id}`}
                                className="bg-[var(--color-primary-light)] text-white hover:bg-[var(--color-primary)] shadow-sm font-semibold"
                              >
                                {busyId === t.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Check-in"
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmação fechar sessão */}
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="sm:max-w-md border-[var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">Finalizar sessão</DialogTitle>
            <DialogDescription className="text-[var(--color-text-muted)]">
              Após finalizar, deixará de ser possível registar presenças e o
              QR Code expira. Confirma esta ação?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmClose(false)}
              disabled={closing}
              className="border-[var(--color-border)] text-[var(--color-text)]"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              disabled={closing}
              data-testid="confirm-finalize"
              className="bg-[var(--color-danger)] text-white font-semibold"
            >
              {closing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A finalizar…
                </>
              ) : (
                "Finalizar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
