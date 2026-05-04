/**
 * Sprint 4 — Eficiência Operacional
 * TESTE-S4-001: Aprovação de inscrição (workflow)
 * TESTE-S4-002: Gestão orçamental
 * TESTE-S4-003: Construtor de relatórios ad-hoc
 * TESTE-S4-004: Sync Google Calendar (somente endpoints; sem chamada externa)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, TrainingFormat, TrainingStatus, CourseStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    fail++;
  }
}

async function loginCookies(email: string, password: string): Promise<string> {
  // Pull CSRF
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies1 = csrfRes.headers.get("set-cookie") || "";
  const csrfCookie = cookies1
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.startsWith("next-auth.csrf-token"))
    .join("; ");

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE_URL}/admin/dashboard`,
    json: "true",
  });
  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie,
    },
    body: body.toString(),
    redirect: "manual",
  });
  const cookies2 = loginRes.headers.get("set-cookie") || "";
  const sessionCookie = cookies2
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.startsWith("next-auth.session-token") || c.startsWith("__Secure-next-auth.session-token"))
    .join("; ");

  return [csrfCookie, sessionCookie].filter(Boolean).join("; ");
}

async function setupFixtures() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "oportoforte" },
    update: {},
    create: { name: "OportoForte", slug: "oportoforte" },
  });

  // Set requireEnrollmentApproval = true
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { requireEnrollmentApproval: true },
  });

  const passwordHash = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin.s4@oportoforte.com" },
    update: { passwordHash, tenantId: tenant.id, role: UserRole.TENANT_ADMIN },
    create: {
      email: "admin.s4@oportoforte.com",
      passwordHash,
      role: UserRole.TENANT_ADMIN,
      firstName: "Admin",
      lastName: "S4",
      tenantId: tenant.id,
    },
  });

  // Trainer
  const trainerPwd = await bcrypt.hash("Trainer123!", 10);
  const trainerUser = await prisma.user.upsert({
    where: { email: "trainer.s4@oportoforte.com" },
    update: { tenantId: tenant.id, role: UserRole.TRAINER },
    create: {
      email: "trainer.s4@oportoforte.com",
      passwordHash: trainerPwd,
      role: UserRole.TRAINER,
      firstName: "Trainer",
      lastName: "S4",
      tenantId: tenant.id,
    },
  });
  let trainer = await prisma.trainer.findUnique({ where: { userId: trainerUser.id } });
  if (!trainer) {
    trainer = await prisma.trainer.create({
      data: { tenantId: tenant.id, userId: trainerUser.id, regions: ["Porto"] },
    });
  }

  // Course + action + session for Google Calendar test
  const course = await prisma.course.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "s4-curso-test" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Curso S4 Test",
      slug: "s4-curso-test",
      durationHours: 8,
      format: TrainingFormat.PRESENCIAL,
      status: CourseStatus.PUBLISHED,
    },
  });

  const action = await prisma.trainingAction.create({
    data: {
      tenantId: tenant.id,
      courseId: course.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 86400000),
      format: TrainingFormat.PRESENCIAL,
      status: TrainingStatus.PLANNED,
    },
  });
  await prisma.trainingActionTrainer.create({
    data: { trainingActionId: action.id, trainerId: trainer.id, role: "MAIN" },
  });

  // Trainee
  const traineePwd = await bcrypt.hash("Trainee123!", 10);
  const traineeUser = await prisma.user.upsert({
    where: { email: "trainee.s4@oportoforte.com" },
    update: { tenantId: tenant.id, role: UserRole.TRAINEE },
    create: {
      email: "trainee.s4@oportoforte.com",
      passwordHash: traineePwd,
      role: UserRole.TRAINEE,
      firstName: "Trainee",
      lastName: "S4",
      tenantId: tenant.id,
    },
  });
  let trainee = await prisma.trainee.findUnique({ where: { userId: traineeUser.id } });
  if (!trainee) {
    trainee = await prisma.trainee.create({
      data: {
        tenantId: tenant.id,
        userId: traineeUser.id,
        firstName: "Trainee",
        lastName: "S4",
        email: traineeUser.email,
      },
    });
  }

  // Plan
  const existingPlan = await prisma.trainingPlan.findFirst({
    where: { tenantId: tenant.id, name: "Plano S4 Test" },
  });
  const plan = existingPlan || await prisma.trainingPlan.create({
    data: {
      tenantId: tenant.id,
      year: 2026,
      name: "Plano S4 Test",
      status: "DRAFT",
      budget: 12000,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    },
  });

  return { tenant, admin, trainer, traineeUser, trainee, action, course, plan };
}

async function cleanupFixtures(tenantId: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { requireEnrollmentApproval: false },
  });
}

async function testS4_001(adminCookie: string, fx: any) {
  console.log("\n=== TESTE-S4-001: Workflow aprovação de inscrições ===");

  // 1. Limpar enrollments e approval requests deste trainee
  await prisma.enrollment.deleteMany({
    where: { trainingActionId: fx.action.id, traineeId: fx.trainee.id },
  });
  await prisma.approvalRequest.deleteMany({
    where: { tenantId: fx.tenant.id, type: "ENROLLMENT", resourceId: fx.trainee.id },
  });

  // Admin enrolls trainee on their behalf — endpoint não permite TRAINEE
  const enrollRes = await fetch(`${BASE_URL}/api/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ trainingActionId: fx.action.id, traineeId: fx.trainee.id }),
  });
  const enrollData = await enrollRes.json().catch(() => ({}));
  ok("Inscrição criada com PENDING (status: pending)", enrollData.status === "pending", JSON.stringify(enrollData));

  const enr = await prisma.enrollment.findFirst({
    where: { trainingActionId: fx.action.id, traineeId: fx.trainee.id },
  });
  ok("Enrollment.status = PENDING_APPROVAL", enr?.status === "PENDING_APPROVAL", `got ${enr?.status}`);

  const approval = await prisma.approvalRequest.findFirst({
    where: { tenantId: fx.tenant.id, type: "ENROLLMENT" },
    orderBy: { requestedAt: "desc" },
  });
  ok("ApprovalRequest criado (PENDING)", approval?.status === "PENDING", `got ${approval?.status}`);

  // Admin approves
  if (approval) {
    const approveRes = await fetch(`${BASE_URL}/api/admin/approvals/${approval.id}/approve`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    ok("POST /approvals/[id]/approve → 200", approveRes.status === 200, `status ${approveRes.status}`);

    const enrAfter = await prisma.enrollment.findFirst({
      where: { trainingActionId: fx.action.id, traineeId: fx.trainee.id },
    });
    ok("Enrollment ficou CONFIRMED após aprovação", enrAfter?.status === "CONFIRMED", `got ${enrAfter?.status}`);

    const approvalAfter = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    ok("ApprovalRequest.status = APPROVED", approvalAfter?.status === "APPROVED", `got ${approvalAfter?.status}`);
  }

  // Test reject path: clean and recreate enrollment → reject
  await prisma.enrollment.deleteMany({
    where: { trainingActionId: fx.action.id, traineeId: fx.trainee.id },
  });
  const enrollRes2 = await fetch(`${BASE_URL}/api/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ trainingActionId: fx.action.id, traineeId: fx.trainee.id }),
  });
  await enrollRes2.json().catch(() => ({}));
  const approval2 = await prisma.approvalRequest.findFirst({
    where: { tenantId: fx.tenant.id, type: "ENROLLMENT", status: "PENDING" },
    orderBy: { requestedAt: "desc" },
  });
  if (approval2) {
    // Try reject without notes → 400
    const rej1 = await fetch(`${BASE_URL}/api/admin/approvals/${approval2.id}/reject`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    ok("Reject sem notes → 400", rej1.status === 400, `got ${rej1.status}`);

    const rej2 = await fetch(`${BASE_URL}/api/admin/approvals/${approval2.id}/reject`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Não cumpre requisitos" }),
    });
    ok("Reject com notes → 200", rej2.status === 200, `got ${rej2.status}`);

    const enrAfter = await prisma.enrollment.findFirst({
      where: { trainingActionId: fx.action.id, traineeId: fx.trainee.id },
    });
    ok("Enrollment ficou CANCELLED após rejeição", enrAfter?.status === "CANCELLED", `got ${enrAfter?.status}`);
  }
}

async function testS4_002(adminCookie: string, fx: any) {
  console.log("\n=== TESTE-S4-002: Gestão orçamental ===");

  // Create an action linked to plan with cost data
  const actionWithBudget = await prisma.trainingAction.create({
    data: {
      tenantId: fx.tenant.id,
      courseId: fx.course.id,
      planId: fx.plan.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 86400000),
      format: TrainingFormat.PRESENCIAL,
      status: TrainingStatus.PLANNED,
      actionCode: "S4-BUDGET-001",
    },
  });

  // POST budget update
  const setBudgetRes = await fetch(`${BASE_URL}/api/admin/actions/${actionWithBudget.id}/costs`, {
    method: "PUT",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ budgetedAmount: 1000 }),
  });
  ok("PUT /actions/[id]/costs (set budget) → 200", setBudgetRes.status === 200, `status ${setBudgetRes.status}`);

  // Add 3 costs (€200, €300, €400 = €900 total → 90% gasto)
  const costs = [
    { description: "Formador", category: "TRAINER", amount: 200, date: new Date().toISOString() },
    { description: "Sala", category: "ROOM", amount: 300, date: new Date().toISOString() },
    { description: "Materiais", category: "MATERIALS", amount: 400, date: new Date().toISOString() },
  ];
  for (const c of costs) {
    const r = await fetch(`${BASE_URL}/api/admin/actions/${actionWithBudget.id}/costs`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify(c),
    });
    if (r.status !== 200) console.log("    cost POST status", r.status, await r.text());
  }

  const budget = await prisma.budget.findUnique({ where: { trainingActionId: actionWithBudget.id } });
  ok("Budget agregado (gasto = 900)", budget?.spentAmount === 900, `spent=${budget?.spentAmount}`);
  ok("Budget orçado = 1000", budget?.budgetedAmount === 1000, `budgeted=${budget?.budgetedAmount}`);

  const trainingCosts = await prisma.trainingCost.count({ where: { trainingActionId: actionWithBudget.id } });
  ok("3 TrainingCost criados", trainingCosts === 3, `got ${trainingCosts}`);

  // Plan budget report — load page
  const reportRes = await fetch(`${BASE_URL}/admin/training-plans/${fx.plan.id}/budget`, {
    headers: { Cookie: adminCookie },
  });
  ok("Página /admin/training-plans/[id]/budget carrega (200)", reportRes.status === 200, `status ${reportRes.status}`);
  const html = await reportRes.text();
  ok("Página contém 'Orçamento'", /Or.amento/.test(html));
  ok("Página tem export PDF link", /export-budget-pdf|api\/admin\/training-plans\/.+\/budget\/export/.test(html));

  // Cleanup
  await prisma.trainingCost.deleteMany({ where: { trainingActionId: actionWithBudget.id } });
  await prisma.budget.deleteMany({ where: { trainingActionId: actionWithBudget.id } });
  await prisma.trainingAction.delete({ where: { id: actionWithBudget.id } });
}

async function testS4_003(adminCookie: string, fx: any) {
  console.log("\n=== TESTE-S4-003: Construtor de relatórios ad-hoc ===");

  // Page loads
  const pageRes = await fetch(`${BASE_URL}/admin/reports`, { headers: { Cookie: adminCookie } });
  ok("/admin/reports carrega (200)", pageRes.status === 200, `status ${pageRes.status}`);

  // POST JSON: enrollments report
  const enrRes = await fetch(`${BASE_URL}/api/admin/reports/generate`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ENROLLMENTS", format: "json", filters: {} }),
  });
  ok("POST /reports/generate (ENROLLMENTS json) → 200", enrRes.status === 200, `status ${enrRes.status}`);
  const enrData = await enrRes.json();
  ok("Resposta tem columns + rows", Array.isArray(enrData.columns) && Array.isArray(enrData.rows));

  // Excel
  const xlsxRes = await fetch(`${BASE_URL}/api/admin/reports/generate`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ENROLLMENTS", format: "xlsx", filters: {} }),
  });
  ok("Excel export → 200", xlsxRes.status === 200);
  const xlsxCT = xlsxRes.headers.get("content-type") || "";
  ok("Content-Type contém spreadsheetml", xlsxCT.includes("spreadsheetml"), xlsxCT);

  // PDF
  const pdfRes = await fetch(`${BASE_URL}/api/admin/reports/generate`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ENROLLMENTS", format: "pdf", filters: {} }),
  });
  ok("PDF export → 200", pdfRes.status === 200);
  const pdfCT = pdfRes.headers.get("content-type") || "";
  ok("Content-Type = application/pdf", pdfCT.includes("application/pdf"), pdfCT);

  // Test other types
  for (const type of ["ATTENDANCE", "SATISFACTION", "BUDGET", "TRAINERS_HOURS", "CERTIFICATES"]) {
    const r = await fetch(`${BASE_URL}/api/admin/reports/generate`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ type, format: "json", filters: {} }),
    });
    ok(`Tipo ${type} → 200`, r.status === 200, `status ${r.status}`);
  }

  // Invalid type → 400
  const badRes = await fetch(`${BASE_URL}/api/admin/reports/generate`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "INVALID_TYPE", format: "json", filters: {} }),
  });
  ok("Tipo inválido → 400", badRes.status === 400);
}

async function testS4_004(adminCookie: string, fx: any) {
  console.log("\n=== TESTE-S4-004: Google Calendar (estrutura, sem chamada externa) ===");

  // Settings page renders gcal panel
  const settingsRes = await fetch(`${BASE_URL}/admin/settings/integrations`, {
    headers: { Cookie: adminCookie },
  });
  ok("/admin/settings/integrations carrega (200)", settingsRes.status === 200, `status ${settingsRes.status}`);
  const html = await settingsRes.text();
  ok("Página contém GoogleCalendarPanel", /Google Calendar/i.test(html));
  ok("Página contém botão Connect ou status", /gcal-connect|gcal-disconnect|gcal-status/.test(html));

  // OAuth init: with no GOOGLE_CLIENT_ID → 500; otherwise 302 redirect
  const authRes = await fetch(`${BASE_URL}/api/integrations/google/auth`, {
    headers: { Cookie: adminCookie },
    redirect: "manual",
  });
  if (process.env.GOOGLE_CLIENT_ID) {
    ok("/api/integrations/google/auth → 302 (redireciona)", authRes.status === 307 || authRes.status === 302, `status ${authRes.status}`);
    const loc = authRes.headers.get("location") || "";
    ok("Redireciona para accounts.google.com", loc.includes("accounts.google.com"));
  } else {
    ok("Sem GOOGLE_CLIENT_ID → 500", authRes.status === 500);
  }

  // Disconnect endpoint accessible
  const disRes = await fetch(`${BASE_URL}/api/integrations/google/disconnect`, {
    method: "POST",
    headers: { Cookie: adminCookie },
  });
  ok("/api/integrations/google/disconnect (POST) → 200", disRes.status === 200, `status ${disRes.status}`);

  const tenant = await prisma.tenant.findUnique({ where: { id: fx.tenant.id } });
  ok("Tenant.googleCalendarEnabled = false após disconnect", tenant?.googleCalendarEnabled === false);

  // Admin sessions endpoint exists; create a session (gcal sync no-op without tokens)
  const newSessionRes = await fetch(`${BASE_URL}/api/admin/sessions`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      trainingActionId: fx.action.id,
      trainerId: fx.trainer.id,
      sessionDate: new Date().toISOString(),
      startTime: "09:00",
      endTime: "13:00",
      durationHours: 4,
    }),
  });
  ok("POST /api/admin/sessions → 200", newSessionRes.status === 200, `status ${newSessionRes.status}`);
  const sessData = await newSessionRes.json();
  ok("Sessão criada com id", !!sessData.session?.id);
  ok("googleEventId = null (sem OAuth ligado)", sessData.googleEventId == null);

  // PATCH
  if (sessData.session?.id) {
    const patchRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessData.session.id}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: "10:00", endTime: "14:00" }),
    });
    ok("PATCH /api/admin/sessions/[id] → 200", patchRes.status === 200);

    // DELETE
    const delRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessData.session.id}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    ok("DELETE /api/admin/sessions/[id] → 200", delRes.status === 200);
  }
}

async function main() {
  console.log("Sprint 4 — Eficiência Operacional");
  console.log(`Base: ${BASE_URL}`);
  let fx: any;
  try {
    fx = await setupFixtures();
    console.log(`Fixtures: tenant=${fx.tenant.id} action=${fx.action.id}`);

    // Reset rate limiter (dev endpoint, may not exist)
    await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: "POST" }).catch(() => null);

    const adminCookie = await loginCookies("admin.s4@oportoforte.com", "Admin123!");
    if (!adminCookie.includes("session-token")) {
      throw new Error("Falha login admin");
    }
    console.log("✓ admin login");

    await testS4_001(adminCookie, fx);
    await testS4_002(adminCookie, fx);
    await testS4_003(adminCookie, fx);
    await testS4_004(adminCookie, fx);
  } catch (e) {
    console.error("ERRO FATAL:", e);
    fail++;
  } finally {
    if (fx?.tenant?.id) await cleanupFixtures(fx.tenant.id);
    await prisma.$disconnect();
  }

  console.log(`\n========================================`);
  console.log(`PASS: ${pass}    FAIL: ${fail}`);
  console.log(`========================================`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
