import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { ExportButtons } from "./ExportButtons";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export default async function ActionDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const tenantId = session.user.tenantId;

  const action = await prisma.trainingAction.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      clientOrg: true,
      room: true,
      sessions: { orderBy: { sessionDate: "asc" } },
      enrollments: {
        include: {
          trainee: {
            include: {
              clientOrg: true,
              signatures: true,
            },
          },
        },
      },
    },
  });
  if (!action || action.tenantId !== tenantId) notFound();

  const sigStats = (docType: string) => {
    let total = 0, signed = 0;
    for (const e of action.enrollments) {
      const sig = e.trainee.signatures.find((s) => s.documentType === docType);
      if (sig) {
        total++;
        if (sig.status === "SIGNED") signed++;
      }
    }
    return { total, signed, count: action.enrollments.length };
  };
  const ficha = sigStats("FICHA_IDENTIFICACAO");
  const presenca = sigStats("REGISTO_PRESENCAS");
  const aval = sigStats("AVALIACAO_FORMANDO");

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">{action.course.name}</h1>
          <p className="text-sm text-gray-600">
            {action.actionCode || action.id.slice(0, 8)} · {action.clientOrg?.name || "—"} ·{" "}
            {fmtDate(action.startDate)} → {fmtDate(action.endDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/actions/${action.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Link>
          </Button>
          <Button asChild className="bg-[#0B2447] hover:bg-[#153460]">
            <Link href={`/api/pdf/${action.id}/REGISTO_PRESENCAS`}>
              <Download className="mr-2 h-4 w-4" /> Exportar Dossier
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="formandos">
        <TabsList>
          <TabsTrigger value="formandos">Formandos ({action.enrollments.length})</TabsTrigger>
          <TabsTrigger value="sessoes">Sessões ({action.sessions.length})</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="formandos">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#0B2447]">Inscritos</CardTitle>
            </CardHeader>
            <CardContent>
              {action.enrollments.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">Sem formandos.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-gray-500">
                      <th className="px-2 py-2">Nome</th>
                      <th className="px-2 py-2">Empresa</th>
                      <th className="px-2 py-2">Ficha Ident.</th>
                      <th className="px-2 py-2">Presença</th>
                      <th className="px-2 py-2">Avaliação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {action.enrollments.map((e) => {
                      const f = e.trainee.signatures.find((s) => s.documentType === "FICHA_IDENTIFICACAO");
                      const p = e.trainee.signatures.find((s) => s.documentType === "REGISTO_PRESENCAS");
                      const av = e.trainee.signatures.find((s) => s.documentType === "AVALIACAO_FORMANDO");
                      return (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="px-2 py-2 font-semibold text-[#0B2447]">
                            {e.trainee.firstName} {e.trainee.lastName}
                          </td>
                          <td className="px-2 py-2">{e.trainee.clientOrg?.name || "—"}</td>
                          <td className="px-2 py-2">
                            <Badge variant={f?.status === "SIGNED" ? undefined : "outline"}>
                              {f?.status || "—"}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            <Badge variant={p?.status === "SIGNED" ? undefined : "outline"}>
                              {p?.status || "—"}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            <Badge variant={av?.status === "SIGNED" ? undefined : "outline"}>
                              {av?.status || "—"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#0B2447]">Sessões</CardTitle>
            </CardHeader>
            <CardContent>
              {action.sessions.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">Sem sessões.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-gray-500">
                      <th className="px-2 py-2">Data</th>
                      <th className="px-2 py-2">Hora</th>
                      <th className="px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {action.sessions.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-2 py-2">{fmtDate(s.sessionDate)}</td>
                        <td className="px-2 py-2">{s.startTime} – {s.endTime}</td>
                        <td className="px-2 py-2">
                          {s.isOpen ? <Badge className="bg-green-600 text-white">Em curso</Badge>
                            : s.isClosed ? <Badge className="bg-gray-400 text-white">Fechada</Badge>
                              : <Badge className="bg-blue-600 text-white">Agendada</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg text-[#0B2447]">Dossier Técnico-Pedagógico (DGERT)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-gray-600">
                Gera os 18 documentos oficiais do dossier (Capa, Programa, Contratos, Folha de Presenças,
                Avaliações, Ocorrências, Relatório Final, etc.) com expansão por formando onde aplicável.
              </p>
              <ExportButtons actionId={action.id} />
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DocCard label="Fichas de Identificação" stats={ficha} actionId={action.id} docType="FICHA_IDENTIFICACAO" />
            <DocCard label="Folhas de Presença" stats={presenca} actionId={action.id} docType="REGISTO_PRESENCAS" />
            <DocCard label="Avaliação Formando" stats={aval} actionId={action.id} docType="AVALIACAO_APRENDIZAGEM" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocCard({
  label,
  stats,
  actionId,
  docType,
}: {
  label: string;
  stats: { total: number; signed: number; count: number };
  actionId: string;
  docType: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-[#0B2447]">
          {stats.signed}<span className="ml-1 text-base text-gray-400">/ {stats.count}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{stats.total} habilitadas</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href={`/api/pdf/${actionId}/${docType}`}>Exportar PDF</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
