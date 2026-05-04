import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";
import { Building2, Calendar } from "lucide-react";

export default async function TraineeCoursesPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TRAINEE") {
    redirect("/login");
  }

  const trainee = await prisma.trainee.findUnique({
    where: { userId: session.user.id },
  });

  if (!trainee) {
    return <div className="p-8 text-center text-gray-500">Perfil não encontrado.</div>;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { traineeId: trainee.id },
    include: {
      trainingAction: {
        include: {
          course: true,
          clientOrg: true,
          _count: { select: { sessions: true } },
          sessions: {
            where: { isClosed: true },
          },
        },
      },
    },
    orderBy: {
      enrolledAt: "desc",
    },
  });

  const active = enrollments.filter((e) => e.status === "CONFIRMED" && e.trainingAction.status === "IN_PROGRESS");
  const scheduled = enrollments.filter((e) => e.status === "CONFIRMED" && e.trainingAction.status === "SCHEDULED");
  const completed = enrollments.filter((e) => e.status === "COMPLETED" || e.trainingAction.status === "COMPLETED");

  const renderCard = (enr: typeof enrollments[0]) => {
    const action = enr.trainingAction;
    const totalSessions = action._count.sessions;
    const completedSessions = action.sessions.length;
    const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    return (
      <Card key={enr.id} className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl text-[#0B2447] line-clamp-2">
            {action.course.name}
          </CardTitle>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <Building2 className="h-4 w-4" />
            <span>{action.clientOrg?.name || "Público Geral"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(action.startDate), "dd/MM/yyyy")} - {format(new Date(action.endDate), "dd/MM/yyyy")}
            </span>
          </div>
        </CardHeader>
        <CardContent className="mt-auto">
          <div className="mb-2 flex justify-between text-sm text-gray-600">
            <span>Progresso</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="mt-2 text-right text-xs text-gray-500">
            {completedSessions} de {totalSessions} sessões
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0B2447]">Meus Cursos</h1>
        <p className="mt-2 text-gray-600">Consulte o seu histórico de formações.</p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-3 bg-white shadow-sm sm:w-auto">
          <TabsTrigger value="active">Em Curso ({active.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Agendadas ({scheduled.length})</TabsTrigger>
          <TabsTrigger value="completed">Concluídas ({completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          {active.length === 0 ? (
            <div className="rounded border bg-white py-12 text-center text-gray-500">Sem cursos a decorrer.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {active.map(renderCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="mt-0">
          {scheduled.length === 0 ? (
            <div className="rounded border bg-white py-12 text-center text-gray-500">Sem cursos agendados.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {scheduled.map(renderCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          {completed.length === 0 ? (
            <div className="rounded border bg-white py-12 text-center text-gray-500">Ainda não concluiu cursos.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map(renderCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
