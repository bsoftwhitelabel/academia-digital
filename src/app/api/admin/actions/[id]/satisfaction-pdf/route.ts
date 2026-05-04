import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf";
import { getLogosAsBase64 } from "@/lib/pdf-logos";
import { renderRelatorioSatisfacao } from "@/templates/pdf/RelatorioSatisfacao";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const action = await prisma.trainingAction.findUnique({
    where: { id: params.id },
    include: { course: true, clientOrg: true, tenant: true },
  });
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (action.tenantId !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Recolher respostas e calcular blocos
  // Schema tem respondedAt @default(now()) — submissão = ter answers.
  const responses = await prisma.questionnaireResponse.findMany({
    where: { trainingActionId: action.id, answers: { some: {} } },
    include: { answers: { include: { question: true } } },
  });
  const totalGenerated = await prisma.questionnaireResponse.count({
    where: { trainingActionId: action.id },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  // Bloco = primeiro lexema da pergunta (heurística simples)
  const blocks: Record<string, { sum: number; count: number }> = {};

  for (const r of responses) {
    for (const a of r.answers) {
      if (a.question.type === "SCALE" && typeof a.scaleValue === "number") {
        if (a.scaleValue >= 1 && a.scaleValue <= 5) {
          distribution[a.scaleValue] = (distribution[a.scaleValue] || 0) + 1;
        }
        // Bloco = primeira palavra do texto da pergunta (Conteúdo, Formador, Organização, etc.)
        const blockLabel = (a.question.text.split(/[\s—:]+/)[0] || "Geral").trim();
        if (!blocks[blockLabel]) blocks[blockLabel] = { sum: 0, count: 0 };
        blocks[blockLabel].sum += a.scaleValue;
        blocks[blockLabel].count += 1;
      }
    }
  }

  const blocksArr = Object.entries(blocks).map(([label, v]) => ({
    label,
    average: v.count > 0 ? v.sum / v.count : 0,
    count: v.count,
  }));

  // Bloco "Global" sempre — média de todos os scale answers
  const allScale = blocksArr.reduce((acc, b) => acc + b.sum, 0);
  const allCount = blocksArr.reduce((acc, b) => acc + b.count, 0);
  if (allCount > 0) {
    blocksArr.push({ label: "Global", average: allScale / allCount, count: allCount });
  }

  const distArr = [1, 2, 3, 4, 5].map((s) => ({ score: s, count: distribution[s] || 0 }));
  const logos = await getLogosAsBase64(action.tenantId, action.clientOrgId);

  const html = renderRelatorioSatisfacao({
    tenant: { name: action.tenant.name },
    action: {
      course: action.course,
      actionCode: action.actionCode,
      startDate: action.startDate,
      endDate: action.endDate,
      clientOrg: action.clientOrg,
    },
    logos,
    blocks: blocksArr,
    distribution: distArr,
    totalResponded: responses.length,
    totalGenerated,
  });

  const pdf = await generatePDF(html, { landscape: false });
  const fname = `satisfacao-${action.actionCode || action.id.slice(0, 8)}.pdf`;
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
