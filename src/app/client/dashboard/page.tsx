import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Award } from "lucide-react";

export default async function ClientDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { clientHrOrg: true },
  });
  const orgId = user?.clientHrOrgId;
  if (!orgId) {
    return (
      <p className="rounded bg-yellow-50 p-4 text-yellow-700 border border-yellow-200">
        Utilizador sem ClientOrg associada. Contacte o administrador.
      </p>
    );
  }

  const [trainees, activeActions, certificates] = await Promise.all([
    prisma.trainee.count({ where: { clientOrgId: orgId } }),
    prisma.trainingAction.count({
      where: {
        clientOrgId: orgId,
        status: { in: ["IN_PROGRESS", "SCHEDULED"] },
      },
    }),
    prisma.certificate.count({
      where: { trainee: { clientOrgId: orgId } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447] sm:text-3xl">Painel — {user.clientHrOrg?.name}</h1>
        <p className="text-sm text-gray-600">Visão geral da formação dos seus colaboradores.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="client-kpis">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Formandos da empresa</CardTitle>
            <Users className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-[#0B2447]">{trainees}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Ações em curso</CardTitle>
            <BookOpen className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-[#0B2447]">{activeActions}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase text-gray-500">Certificados emitidos</CardTitle>
            <Award className="h-4 w-4 text-[#C9A520]" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-[#0B2447]">{certificates}</div></CardContent>
        </Card>
      </div>
    </div>
  );
}
