import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Award, BookOpen, Clock, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

export default async function TraineeDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TRAINEE") {
    redirect("/login");
  }

  const trainee = await prisma.trainee.findUnique({
    where: { userId: session.user.id },
  });

  if (!trainee) {
    return (
      <div className="p-8 text-center text-[var(--color-text-muted)]">
        Perfil de formando não encontrado. Contacte a administração.
      </div>
    );
  }

  // KPIs
  const completedCourses = await prisma.enrollment.count({
    where: { traineeId: trainee.id, status: "COMPLETED" },
  });

  const certificatesCount = await prisma.certificate.count({
    where: { traineeId: trainee.id },
  });

  // Para as horas, podemos somar a duração dos cursos concluídos
  const enrollmentsCompleted = await prisma.enrollment.findMany({
    where: { traineeId: trainee.id, status: "COMPLETED" },
    include: { trainingAction: { include: { course: true } } },
  });
  const totalHours = enrollmentsCompleted.reduce(
    (acc, curr) => acc + curr.trainingAction.course.durationHours,
    0
  );

  // Sessão em curso HOJE (isOpen = true e inscrito na ação)
  const currentSession = await prisma.trainingSession.findFirst({
    where: {
      isOpen: true,
      trainingAction: {
        enrollments: {
          some: { traineeId: trainee.id, status: "CONFIRMED" },
        },
      },
    },
    include: {
      trainingAction: { include: { course: true } },
    },
  });

  // Próximas 3 sessões
  const upcomingSessions = await prisma.trainingSession.findMany({
    where: {
      sessionDate: { gte: new Date() },
      isOpen: false,
      isClosed: false,
      trainingAction: {
        enrollments: {
          some: { traineeId: trainee.id, status: "CONFIRMED" },
        },
      },
    },
    include: {
      trainingAction: { include: { course: true } },
    },
    orderBy: { sessionDate: "asc" },
    take: 3,
  });

  // Cursos ativos com progresso
  const activeEnrollments = await prisma.enrollment.findMany({
    where: { traineeId: trainee.id, status: "CONFIRMED" },
    include: {
      trainingAction: {
        include: {
          course: true,
          _count: { select: { sessions: true } },
          sessions: {
            where: { isClosed: true },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold text-[var(--color-primary)] tracking-tight">Painel de Bordo</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">
          Bem-vindo de volta! Acompanhe o seu progresso na formação.
        </p>
      </div>

      {/* Banner de Sessão em Curso */}
      {currentSession && (
        <div className="relative overflow-hidden flex flex-col items-start justify-between gap-6 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] p-8 text-white shadow-xl sm:flex-row sm:items-center">
          <div className="absolute top-0 right-0 opacity-10">
             <CalendarIcon className="w-48 h-48 -mr-10 -mt-10" />
          </div>
          <div className="relative z-10">
            <span className="mb-3 flex items-center w-max gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-sm border border-white/10">
              <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse"></span>
              A decorrer agora
            </span>
            <h2 className="text-2xl font-black sm:text-3xl tracking-tight drop-shadow-sm">
              {currentSession.trainingAction.course.name}
            </h2>
            <p className="mt-2 text-white/80 font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Sessão das {currentSession.startTime} às {currentSession.endTime}
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="relative z-10 w-full sm:w-auto bg-[var(--color-accent)] font-bold text-[var(--color-primary)] hover:bg-[var(--color-accent)]/90 hover:scale-105 transition-all shadow-lg rounded-xl h-14 px-8 text-lg"
          >
            <Link href={`/trainee/checkin/${currentSession.id}`}>
              Check-in Agora <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Card className="border-[var(--color-border)] shadow-sm bg-[var(--color-surface-2)]">
          <CardContent className="p-6">
             <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Cursos Concluídos</p>
                  <p className="text-4xl font-black text-[var(--color-text)]">{completedCourses}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                   <BookOpen className="h-7 w-7 text-[var(--color-primary)]" />
                </div>
             </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--color-border)] shadow-sm bg-[var(--color-surface-2)]">
          <CardContent className="p-6">
             <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Horas de Formação</p>
                  <p className="text-4xl font-black text-[var(--color-text)]">{totalHours}h</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
                   <Clock className="h-7 w-7 text-[var(--color-accent)]" />
                </div>
             </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--color-border)] shadow-sm bg-[var(--color-surface-2)]">
          <CardContent className="p-6">
             <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Certificados</p>
                  <p className="text-4xl font-black text-[var(--color-text)]">{certificatesCount}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center">
                   <Award className="h-7 w-7 text-[var(--color-success)]" />
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Cursos Ativos */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-[var(--color-primary)]">Cursos Ativos</h2>
          {activeEnrollments.length === 0 ? (
            <Card className="border-[var(--color-border)] shadow-sm bg-[var(--color-surface-2)]">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-[var(--color-text-muted)]">
                <BookOpen className="mb-4 h-12 w-12 text-[var(--color-border)]" />
                <p>Não tem nenhum curso a decorrer no momento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {activeEnrollments.map((enr) => {
                const action = enr.trainingAction;
                const totalSessions = action._count.sessions;
                const completedSessions = action.sessions.length;
                const progress =
                  totalSessions > 0
                    ? Math.round((completedSessions / totalSessions) * 100)
                    : 0;

                return (
                  <Card key={enr.id} className="border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow bg-[var(--color-surface-2)] group overflow-hidden">
                    <CardHeader className="bg-[var(--color-surface)]/50 border-b border-[var(--color-border)] pb-4">
                      <CardTitle className="line-clamp-2 text-lg font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary-light)] transition-colors">
                        {action.course.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="mb-2 flex justify-between text-sm text-[var(--color-text-muted)]">
                        <span className="font-medium">Progresso</span>
                        <span className="font-bold text-[var(--color-text)]">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2.5 bg-[var(--color-surface)] [&>div]:bg-[var(--color-primary-light)]" />
                      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                        <span>{completedSessions} concluídas</span>
                        <span>{totalSessions} total</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Próximas Sessões */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--color-primary)]">Próximas Sessões</h2>
          {upcomingSessions.length === 0 ? (
            <Card className="border-[var(--color-border)] shadow-sm bg-[var(--color-surface-2)]">
              <CardContent className="py-12 text-center text-[var(--color-text-muted)] flex flex-col items-center">
                <CalendarIcon className="w-10 h-10 mb-3 text-[var(--color-border)]" />
                <span>Sem sessões agendadas.</span>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <Card key={session.id} className="border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow bg-[var(--color-surface-2)] group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary-light)]"></div>
                  <CardContent className="p-5 pl-6">
                    <div className="mb-1 text-xs font-bold tracking-widest uppercase text-[var(--color-accent)]">
                      {format(new Date(session.sessionDate), "dd 'de' MMMM", {
                        locale: ptBR,
                      })}
                    </div>
                    <h3 className="font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary-light)] transition-colors line-clamp-1 mb-2">
                      {session.trainingAction.course.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] bg-[var(--color-surface)] w-max px-2.5 py-1 rounded-md font-medium border border-[var(--color-border)]">
                      <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                      <span>
                        {session.startTime} - {session.endTime}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
