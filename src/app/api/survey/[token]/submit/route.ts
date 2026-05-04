import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const response = await prisma.questionnaireResponse.findUnique({
      where: { token: params.token },
      include: {
        questionnaire: { include: { questions: true } },
        _count: { select: { answers: true } },
      },
    });
    if (!response) {
      return NextResponse.json({ error: "Token inválido" }, { status: 404 });
    }
    // Schema tem respondedAt @default(now()) — usamos answers como sinal.
    if (response._count.answers > 0) {
      return NextResponse.json(
        { error: "Esta resposta já foi submetida" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const incoming: Array<{ questionId: string; scaleValue?: number | null; textValue?: string | null }> =
      Array.isArray(body.answers) ? body.answers : [];

    // Validar perguntas obrigatórias
    const validQuestionIds = new Set(response.questionnaire.questions.map((q) => q.id));
    const required = response.questionnaire.questions.filter((q) => q.isRequired);
    const byQid: Record<string, any> = {};
    for (const a of incoming) {
      if (validQuestionIds.has(a.questionId)) byQid[a.questionId] = a;
    }
    for (const q of required) {
      const a = byQid[q.id];
      const hasScale = typeof a?.scaleValue === "number";
      const hasText = typeof a?.textValue === "string" && a.textValue.length > 0;
      if (q.type === "SCALE" && !hasScale) {
        return NextResponse.json({ error: `Pergunta obrigatória sem resposta: ${q.text}` }, { status: 400 });
      }
      if ((q.type === "TEXT" || q.type === "BOOLEAN") && !hasText) {
        return NextResponse.json({ error: `Pergunta obrigatória sem resposta: ${q.text}` }, { status: 400 });
      }
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.questionnaireAnswer.deleteMany({ where: { responseId: response.id } }),
      ...incoming
        .filter((a) => validQuestionIds.has(a.questionId))
        .map((a) =>
          prisma.questionnaireAnswer.create({
            data: {
              responseId: response.id,
              questionId: a.questionId,
              scaleValue: typeof a.scaleValue === "number" ? a.scaleValue : null,
              textValue: typeof a.textValue === "string" ? a.textValue : null,
            },
          })
        ),
      prisma.questionnaireResponse.update({
        where: { id: response.id },
        data: { respondedAt: now },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Survey submit error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
