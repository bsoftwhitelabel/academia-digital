import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "TENANT_STAFF", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  const trainerId = url.searchParams.get("trainerId");
  const clientOrgId = url.searchParams.get("clientOrgId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: any = {
    questionnaire: { tenantId },
    answers: { some: {} },
  };
  if (from || to) {
    where.respondedAt = {};
    if (from) (where.respondedAt as any).gte = new Date(from);
    if (to) {
      const t = new Date(to); t.setUTCHours(23, 59, 59, 999);
      (where.respondedAt as any).lte = t;
    }
  }
  if (courseId || trainerId || clientOrgId) {
    const actionWhere: any = { tenantId };
    if (courseId) actionWhere.courseId = courseId;
    if (clientOrgId) actionWhere.clientOrgId = clientOrgId;
    if (trainerId) actionWhere.trainers = { some: { trainerId } };
    const matched = await prisma.trainingAction.findMany({
      where: actionWhere, select: { id: true },
    });
    where.trainingActionId = { in: matched.map((m) => m.id) };
  }

  const responses = await prisma.questionnaireResponse.findMany({
    where,
    include: {
      answers: { include: { question: true } },
    },
  });

  const actionIds = Array.from(new Set(responses.map((r) => r.trainingActionId).filter(Boolean) as string[]));
  const actionsMap = new Map<string, any>();
  if (actionIds.length > 0) {
    const acts = await prisma.trainingAction.findMany({
      where: { id: { in: actionIds }, tenantId },
      include: {
        course: { select: { id: true, name: true } },
        trainers: { include: { trainer: { include: { user: true } } } },
      },
    });
    for (const a of acts) actionsMap.set(a.id, a);
  }

  let allScale: number[] = [];
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const byTrainer: Record<string, { name: string; sum: number; count: number }> = {};
  const byCourse: Record<string, { name: string; sum: number; count: number }> = {};
  const byMonth: Record<string, { sum: number; count: number }> = {};
  const byWeek: Record<string, { sum: number; count: number; weekStart: string }> = {};

  const isoWeekKey = (d: Date): { key: string; start: string } => {
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() || 7) - 1)));
    return {
      key: `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`,
      start: monday.toISOString().slice(0, 10),
    };
  };

  for (const r of responses) {
    const action = r.trainingActionId ? actionsMap.get(r.trainingActionId) : null;
    for (const a of r.answers) {
      if (a.question.type === "SCALE" && typeof a.scaleValue === "number") {
        allScale.push(a.scaleValue);
        if (a.scaleValue >= 1 && a.scaleValue <= 5) distribution[a.scaleValue] = (distribution[a.scaleValue] || 0) + 1;
        for (const t of action?.trainers || []) {
          const name = `${t.trainer.user.firstName} ${t.trainer.user.lastName}`.trim();
          if (!byTrainer[t.trainerId]) byTrainer[t.trainerId] = { name, sum: 0, count: 0 };
          byTrainer[t.trainerId].sum += a.scaleValue;
          byTrainer[t.trainerId].count += 1;
        }
        const cid = action?.courseId;
        const cname = action?.course?.name;
        if (cid && cname) {
          if (!byCourse[cid]) byCourse[cid] = { name: cname, sum: 0, count: 0 };
          byCourse[cid].sum += a.scaleValue;
          byCourse[cid].count += 1;
        }
        if (r.respondedAt) {
          const ym = `${r.respondedAt.getUTCFullYear()}-${String(r.respondedAt.getUTCMonth() + 1).padStart(2, "0")}`;
          if (!byMonth[ym]) byMonth[ym] = { sum: 0, count: 0 };
          byMonth[ym].sum += a.scaleValue;
          byMonth[ym].count += 1;
          const wk = isoWeekKey(r.respondedAt);
          if (!byWeek[wk.key]) byWeek[wk.key] = { sum: 0, count: 0, weekStart: wk.start };
          byWeek[wk.key].sum += a.scaleValue;
          byWeek[wk.key].count += 1;
        }
      }
    }
  }

  const globalAverage = allScale.length > 0
    ? Number((allScale.reduce((s, n) => s + n, 0) / allScale.length).toFixed(2))
    : 0;

  const totalGenerated = await prisma.questionnaireResponse.count({
    where: { questionnaire: { tenantId } },
  });
  const totalResponded = responses.length;
  const responseRate = totalGenerated > 0 ? Math.round((totalResponded / totalGenerated) * 100) : 0;

  const trainerRanking = Object.entries(byTrainer)
    .map(([id, v]) => ({ trainerId: id, name: v.name, average: Number((v.sum / v.count).toFixed(2)), count: v.count }))
    .sort((a, b) => b.average - a.average);

  const monthlyTrend = Object.entries(byMonth)
    .map(([month, v]) => ({ month, average: Number((v.sum / v.count).toFixed(2)) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Last 12 weeks
  const weeklyTrend: { week: string; weekStart: string; average: number; count: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
    const wk = isoWeekKey(d);
    const data = byWeek[wk.key];
    weeklyTrend.push({
      week: wk.key,
      weekStart: wk.start,
      average: data ? Number((data.sum / data.count).toFixed(2)) : 0,
      count: data?.count || 0,
    });
  }

  const courseAlerts = Object.entries(byCourse)
    .map(([id, v]) => ({ courseId: id, name: v.name, average: Number((v.sum / v.count).toFixed(2)), responses: v.count }))
    .filter((c) => c.average < 3.5)
    .sort((a, b) => a.average - b.average);

  // Trainer alerts (avg < 3.5)
  const trainerAlerts = trainerRanking.filter((t) => t.average < 3.5);

  // Stale actions: concluded > 7d ago without any responded questionnaire response
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const completedActions = await prisma.trainingAction.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      endDate: { lt: sevenDaysAgo },
    },
    include: { course: { select: { name: true } } },
  });
  const completedIds = completedActions.map((a) => a.id);
  const respondedActionIds = new Set<string>();
  if (completedIds.length > 0) {
    const respondedRows = await prisma.questionnaireResponse.findMany({
      where: {
        trainingActionId: { in: completedIds },
        questionnaire: { tenantId },
        answers: { some: {} },
      },
      select: { trainingActionId: true },
    });
    for (const r of respondedRows) if (r.trainingActionId) respondedActionIds.add(r.trainingActionId);
  }
  const staleActions = completedActions
    .filter((a) => !respondedActionIds.has(a.id))
    .map((a) => ({
      id: a.id,
      name: a.course.name,
      code: a.actionCode || a.id.slice(0, 8),
      endDate: a.endDate?.toISOString().slice(0, 10) || null,
      daysSince: a.endDate ? Math.floor((Date.now() - a.endDate.getTime()) / 86400000) : null,
    }));

  const distArray = [1, 2, 3, 4, 5].map((n) => ({ score: String(n), count: distribution[n] || 0 }));

  const bestTrainer = trainerRanking[0] || null;

  return NextResponse.json({
    globalAverage,
    totalResponded,
    totalGenerated,
    responseRate,
    bestTrainer,
    trainerRanking,
    monthlyTrend,
    weeklyTrend,
    distribution: distArray,
    courseAlerts,
    trainerAlerts,
    staleActions,
    responseRateAlert: responseRate < 50 && totalGenerated >= 10,
  });
  } catch (e: any) {
    console.error("Analytics satisfaction error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
