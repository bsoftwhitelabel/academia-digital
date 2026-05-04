import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { SurveyTrainerClient } from "./SurveyTrainerClient";

export default async function TrainerSurveyPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "TRAINER" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const ts = await prisma.trainingSession.findUnique({
    where: { id: params.sessionId },
    include: {
      trainingAction: {
        include: {
          course: true,
          trainers: true,
          enrollments: { include: { trainee: true } },
        },
      },
    },
  });
  if (!ts) notFound();

  // Autorização do trainer
  if (session.user.role === "TRAINER") {
    const trainer = await prisma.trainer.findUnique({ where: { userId: session.user.id } });
    const ok = !!trainer && (ts.trainerId === trainer.id ||
      ts.trainingAction.trainers.some((t) => t.trainerId === trainer.id));
    if (!ok) {
      return (
        <div className="rounded bg-red-50 p-4 text-red-700 border border-red-200">
          Não está atribuído a esta sessão.
        </div>
      );
    }
  }

  // Listar Questionários do tenant
  const questionnaires = await prisma.questionnaire.findMany({
    where: { tenantId: ts.trainingAction.tenantId, targetRole: "TRAINEE" },
  });

  return (
    <SurveyTrainerClient
      trainingActionId={ts.trainingActionId}
      sessionId={ts.id}
      courseName={ts.trainingAction.course.name}
      questionnaires={questionnaires.map((q) => ({ id: q.id, name: q.name }))}
      traineeCount={ts.trainingAction.enrollments.length}
    />
  );
}
