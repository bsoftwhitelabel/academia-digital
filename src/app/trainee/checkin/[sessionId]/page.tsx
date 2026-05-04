import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckInButton } from "./CheckInButton";
import { Clock, Calendar, MapPin, XCircle } from "lucide-react";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function CheckInPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TRAINEE") {
    redirect("/login");
  }

  const trainee = await prisma.trainee.findUnique({
    where: { userId: session.user.id },
  });

  if (!trainee) {
    redirect("/trainee/dashboard");
  }

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: params.sessionId },
    include: {
      trainingAction: {
        include: {
          course: true,
          room: true,
          enrollments: {
            where: { traineeId: trainee.id, status: "CONFIRMED" },
          },
        },
      },
      checkIns: {
        where: { traineeId: trainee.id },
      },
    },
  });

  if (!trainingSession) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-16 w-16 text-red-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Sessão não encontrada</h2>
      </div>
    );
  }

  const action = trainingSession.trainingAction;

  // 1. Sessão isOpen = true
  if (!trainingSession.isOpen) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-16 w-16 text-yellow-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Sessão Fechada</h2>
        <p className="mt-2 text-gray-500">O formador ainda não abriu ou já fechou o período de check-in desta sessão.</p>
        <Button asChild className="mt-6">
          <Link href="/trainee/dashboard">Voltar ao Painel</Link>
        </Button>
      </div>
    );
  }

  // 2. Formando inscrito
  if (action.enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-16 w-16 text-red-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Não Autorizado</h2>
        <p className="mt-2 text-gray-500">Não está inscrito nesta ação de formação.</p>
        <Button asChild className="mt-6">
          <Link href="/trainee/dashboard">Voltar ao Painel</Link>
        </Button>
      </div>
    );
  }

  // 3. Janela de check-in ativa (se configurado)
  const now = new Date();
  if (
    trainingSession.checkinOpenAt &&
    now < trainingSession.checkinOpenAt
  ) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-16 w-16 text-yellow-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Aguarde...</h2>
        <p className="mt-2 text-gray-500">O período de check-in ainda não iniciou.</p>
      </div>
    );
  }

  if (
    trainingSession.checkinCloseAt &&
    now > trainingSession.checkinCloseAt
  ) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-16 w-16 text-red-500" />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Check-in Encerrado</h2>
        <p className="mt-2 text-gray-500">O tempo para marcar presença expirou.</p>
      </div>
    );
  }

  // 4. Já fez check-in?
  if (trainingSession.checkIns.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckInButton sessionId={""} /> {/* Placeholder to show we handled the logic */}
          {/* We actually just render the success message statically here to avoid the nested layout bug */}
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Check-in Realizado</h2>
        <p className="mt-2 text-gray-500">Já registou a sua presença nesta sessão.</p>
        <Button asChild className="mt-6 bg-[#0B2447] hover:bg-[#153460]">
          <Link href="/trainee/dashboard">Voltar ao Painel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0B2447]">Registo de Presença</h1>
        <p className="mt-2 text-gray-600">Confirme a sua presença na sessão atual.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-[#0B2447]">
            {action.course.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-gray-600">
            <Calendar className="h-5 w-5 text-[#C9A520]" />
            <span>
              {format(new Date(trainingSession.sessionDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Clock className="h-5 w-5 text-[#C9A520]" />
            <span>
              {trainingSession.startTime} às {trainingSession.endTime}
            </span>
          </div>
          {action.room && (
            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="h-5 w-5 text-[#C9A520]" />
              <span>{action.room.name}</span>
            </div>
          )}

          <div className="mt-8">
            <CheckInButton sessionId={trainingSession.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
