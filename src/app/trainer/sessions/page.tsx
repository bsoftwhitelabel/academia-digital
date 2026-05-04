import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { StartSessionButton } from "./StartSessionButton";

type SessionState = "scheduled" | "in_progress" | "completed";

function classifySession(s: { isOpen: boolean; isClosed: boolean; sessionDate: Date }): SessionState {
  if (s.isOpen) return "in_progress";
  if (s.isClosed) return "completed";
  return "scheduled";
}

function StateBadge({ state }: { state: SessionState }) {
  if (state === "in_progress") {
    return <Badge className="bg-green-600 text-white hover:bg-green-700">Em Curso</Badge>;
  }
  if (state === "completed") {
    return <Badge className="bg-gray-400 text-white hover:bg-gray-500">Concluída</Badge>;
  }
  return <Badge className="bg-blue-600 text-white hover:bg-blue-700">Agendada</Badge>;
}

function SessionCard({
  session,
}: {
  session: {
    id: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    isOpen: boolean;
    isClosed: boolean;
    state: SessionState;
    courseName: string;
    turma: string;
    roomName: string;
    enrollmentCount: number;
  };
}) {
  return (
    <Card key={session.id} className="overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg leading-tight text-[#0B2447]">
            {session.courseName}
          </CardTitle>
          <StateBadge state={session.state} />
        </div>
        <p className="text-sm text-gray-500">{session.turma}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#C9A520]" />
            <span>
              {format(new Date(session.sessionDate), "dd 'de' MMMM, yyyy", {
                locale: ptBR,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#C9A520]" />
            <span>
              {session.startTime} – {session.endTime}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#C9A520]" />
            <span>{session.roomName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#C9A520]" />
            <span>
              {session.enrollmentCount}{" "}
              {session.enrollmentCount === 1 ? "formando" : "formandos"}
            </span>
          </div>
        </div>

        <div className="pt-2">
          {session.state === "in_progress" ? (
            <Button
              asChild
              className="w-full bg-[#0B2447] text-white hover:bg-[#153460]"
            >
              <Link href={`/trainer/sessions/${session.id}/attendance`}>
                Continuar
              </Link>
            </Button>
          ) : session.state === "scheduled" ? (
            <StartSessionButton sessionId={session.id} />
          ) : (
            <Button
              asChild
              variant="outline"
              className="w-full"
            >
              <Link href={`/trainer/sessions/${session.id}/attendance`}>
                Ver Detalhes
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-gray-500">
        {message}
      </CardContent>
    </Card>
  );
}

function SessionGrid({
  sessions,
  emptyMessage,
}: {
  sessions: any[];
  emptyMessage: string;
}) {
  if (sessions.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </div>
  );
}

export default async function TrainerSessionsPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "TRAINER" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const trainer = await prisma.trainer.findUnique({
    where: { userId: session.user.id },
  });

  if (!trainer) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[#0B2447]">Minhas Sessões</h1>
        <p className="text-gray-500">
          Perfil de formador não encontrado. Contacte a administração.
        </p>
      </div>
    );
  }

  // Buscar TrainingActionTrainer onde trainerId = formador
  const actionLinks = await prisma.trainingActionTrainer.findMany({
    where: { trainerId: trainer.id },
    include: {
      trainingAction: {
        include: {
          course: true,
          clientOrg: true,
          room: true,
          _count: { select: { enrollments: true } },
          sessions: { orderBy: { sessionDate: "asc" } },
        },
      },
    },
  });

  // Achatar para sessões com info da action
  const allSessions = actionLinks.flatMap((link) => {
    const a = link.trainingAction;
    const turma =
      a.actionCode || a.actionNumber || a.clientOrg?.name || "Turma sem código";
    return a.sessions.map((s) => ({
      id: s.id,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      isOpen: s.isOpen,
      isClosed: s.isClosed,
      closedAt: s.closedAt,
      state: classifySession(s),
      courseName: a.course.name,
      turma,
      roomName: a.room?.name || (a.format === "ELEARNING" ? "E-learning" : "Sem sala"),
      enrollmentCount: a._count.enrollments,
    }));
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = allSessions
    .filter((s) => s.state === "scheduled" && new Date(s.sessionDate) >= today)
    .sort((a, b) => +new Date(a.sessionDate) - +new Date(b.sessionDate));
  const inProgress = allSessions.filter((s) => s.state === "in_progress");
  const completed = allSessions
    .filter((s) => s.state === "completed")
    .sort((a, b) => +new Date(b.sessionDate) - +new Date(a.sessionDate))
    .slice(0, 30);
  const history = [...allSessions].sort(
    (a, b) => +new Date(b.sessionDate) - +new Date(a.sessionDate)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0B2447]">Minhas Sessões</h1>
        <p className="mt-2 text-gray-600">
          Sessões em que está alocado como formador.
        </p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="upcoming">
            Próximas <span className="ml-1 text-xs opacity-70">({upcoming.length})</span>
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            Em Curso <span className="ml-1 text-xs opacity-70">({inProgress.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Concluídas <span className="ml-1 text-xs opacity-70">({completed.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history">
            Histórico <span className="ml-1 text-xs opacity-70">({history.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <SessionGrid sessions={upcoming} emptyMessage="Sem sessões agendadas." />
        </TabsContent>
        <TabsContent value="in_progress">
          <SessionGrid sessions={inProgress} emptyMessage="Nenhuma sessão a decorrer." />
        </TabsContent>
        <TabsContent value="completed">
          <SessionGrid sessions={completed} emptyMessage="Nenhuma sessão concluída recentemente." />
        </TabsContent>
        <TabsContent value="history">
          <SessionGrid sessions={history} emptyMessage="Sem histórico." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
