import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText } from "lucide-react";

export default async function ClientTraineesPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { clientHrOrgId: true, clientHrOrg: { select: { name: true } } },
  });
  if (!user?.clientHrOrgId) {
    return (
      <p className="rounded bg-yellow-50 p-4 text-yellow-700 border border-yellow-200">
        Utilizador sem ClientOrg associada.
      </p>
    );
  }

  const trainees = await prisma.trainee.findMany({
    where: { clientOrgId: user.clientHrOrgId },
    include: { signatures: true, enrollments: { include: { trainingAction: true } } },
    orderBy: { firstName: "asc" },
  });

  const sigBadge = (status: string | null | undefined) => {
    if (!status) return <Badge variant="outline">—</Badge>;
    if (status === "SIGNED") return <Badge className="bg-green-600 text-white">Assinada</Badge>;
    if (status === "ENABLED") return <Badge className="bg-blue-600 text-white">Pendente</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Formandos da empresa</h1>
          <p className="text-sm text-gray-600">{trainees.length} formandos da {user.clientHrOrg?.name}.</p>
        </div>
        <Button asChild className="bg-[#0B2447] hover:bg-[#153460]">
          <Link href={`/api/client/report`}>
            <FileText className="mr-2 h-4 w-4" /> Exportar relatório
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg text-[#0B2447]">Lista</CardTitle></CardHeader>
        <CardContent>
          {trainees.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Sem formandos da empresa.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="client-trainees-table">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="px-2 py-2">Nome</th>
                    <th className="px-2 py-2">Email</th>
                    <th className="px-2 py-2">Inscrições</th>
                    <th className="px-2 py-2">Ficha</th>
                    <th className="px-2 py-2">Presença</th>
                    <th className="px-2 py-2">Avaliação</th>
                  </tr>
                </thead>
                <tbody>
                  {trainees.map((t) => {
                    const f = t.signatures.find((s) => s.documentType === "FICHA_IDENTIFICACAO");
                    const p = t.signatures.find((s) => s.documentType === "REGISTO_PRESENCAS");
                    const av = t.signatures.find((s) => s.documentType === "AVALIACAO_FORMANDO");
                    return (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-2 py-2 font-semibold text-[#0B2447]">
                          {t.firstName} {t.lastName}
                        </td>
                        <td className="px-2 py-2 text-gray-700">{t.email}</td>
                        <td className="px-2 py-2 text-gray-700">{t.enrollments.length}</td>
                        <td className="px-2 py-2">{sigBadge(f?.status)}</td>
                        <td className="px-2 py-2">{sigBadge(p?.status)}</td>
                        <td className="px-2 py-2">{sigBadge(av?.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
