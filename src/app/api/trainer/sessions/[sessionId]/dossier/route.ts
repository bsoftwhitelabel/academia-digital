import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type Body = {
  didacticResources?: string[];
  summary?: string;
  trainerSignatureUrl?: string;
  occurrences?: Array<{
    description: string;
    responsibleSignatureUrl?: string;
    occurredAt?: string;
  }>;
};

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "TRAINER" && session.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { userId: session.user.id },
    });

    const trainingSession = await prisma.trainingSession.findUnique({
      where: { id: params.sessionId },
      include: { trainingAction: { include: { trainers: true } } },
    });
    if (!trainingSession) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    const isAssigned =
      trainer &&
      (trainingSession.trainerId === trainer.id ||
        trainingSession.trainingAction.trainers.some((t) => t.trainerId === trainer.id));
    if (!isAssigned && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 });
    }

    const body = (await req.json()) as Body;
    if (!body.trainerSignatureUrl) {
      return NextResponse.json(
        { error: "Assinatura do formador obrigatória" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Update session
    await prisma.trainingSession.update({
      where: { id: trainingSession.id },
      data: {
        didacticResources: body.didacticResources ?? [],
        summary: body.summary ?? null,
        trainerSignatureUrl: body.trainerSignatureUrl,
        trainerSignedAt: now,
      },
    });

    // Create occurrences (apenas as que têm descrição)
    const validOcc = (body.occurrences ?? []).filter(
      (o) => typeof o.description === "string" && o.description.trim().length > 0
    );

    const occurrencesCreated: string[] = [];
    for (const occ of validOcc) {
      const created = await prisma.occurrence.create({
        data: {
          trainingActionId: trainingSession.trainingActionId,
          description: occ.description.trim(),
          occurredAt: occ.occurredAt ? new Date(occ.occurredAt) : now,
          reportedById: session.user.id,
          trainerSignatureUrl: body.trainerSignatureUrl,
          responsibleSignatureUrl: occ.responsibleSignatureUrl ?? null,
        },
      });
      occurrencesCreated.push(created.id);
    }

    return NextResponse.json({
      success: true,
      sessionId: trainingSession.id,
      occurrencesCreated,
      trainerSignedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Save dossier error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
