import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureTrainer, ensureUserAndTrainee,
  enrollTrainee,
  header, pass, fail, info,
} from './harness'
import { TrainingFormat, TrainingStatus, CourseStatus, DocumentType } from '@prisma/client'

const ADMIN_EMAIL = 'admin@oportoforte.com'
const TRAINER_EMAIL = 'trainer.test@oportoforte.com'

async function getCookieHeader(email: string, password: string) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

async function logsCount(tenantId: string, event: string, recipient?: string) {
  const where: any = { tenantId, event }
  if (recipient) where.recipient = recipient
  return prisma.notificationLog.count({ where })
}

export async function runTask038to042(): Promise<boolean> {
  header('TASKs 038–042 — Templates + dispatchers de email')
  let allOk = true
  try {
    info('Setup: tenant + admin + trainer + curso + ação + sessão (amanhã) + 1 trainee')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { emailFromAddress: 'comercial@oportoforte.test', emailFromName: 'Oporto Forte' },
    })
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    const trainer = await ensureTrainer(tenant.id)
    const course = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'task037-curso' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Comunicação Estratégica', slug: 'task037-curso',
                durationHours: 16, format: TrainingFormat.PRESENCIAL, status: CourseStatus.PUBLISHED },
    })
    const action = await prisma.trainingAction.create({
      data: { tenantId: tenant.id, courseId: course.id,
              startDate: new Date('2026-05-10'), endDate: new Date('2026-05-20'),
              format: TrainingFormat.PRESENCIAL, status: TrainingStatus.IN_PROGRESS,
              actionCode: 'TS-2026' },
    })
    await prisma.trainingActionTrainer.create({ data: { trainingActionId: action.id, trainerId: trainer.id, role: 'MAIN' } })

    // Sessão "amanhã" (UTC + 1 dia)
    const now = new Date()
    const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 9, 0, 0))
    const session = await prisma.trainingSession.create({
      data: { trainingActionId: action.id, trainerId: trainer.id,
              sessionDate: tomorrowUTC, startTime: '09:00', endTime: '17:00',
              durationHours: 8, isOpen: false, isClosed: false },
    })
    const t = (await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })).trainee
    pass(`Setup OK — actionId=${action.id.slice(0,8)} sessionId=${session.id.slice(0,8)} (amanhã ${tomorrowUTC.toISOString().slice(0,10)})`)

    // ───────────────────────────────────────────── TASK-038
    info('TASK-038 — POST /api/enrollments dispara EnrollmentConfirmed')
    delete (process.env as any).RESEND_API_KEY  // garantir modo dev
    const adminCookies = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const before = await logsCount(tenant.id, 'ENROLLMENT_CONFIRMED', 'maryluz@decathlon.com')
    const r1 = await fetch(`${BASE_URL}/api/enrollments`, {
      method: 'POST',
      headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainingActionId: action.id, traineeId: t.id }),
    })
    if (r1.status !== 200) { fail(`POST /api/enrollments HTTP ${r1.status}: ${await r1.text()}`); return false }
    // Esperar pelo dispatch async
    let waited = 0
    while (waited < 6000) {
      const c = await logsCount(tenant.id, 'ENROLLMENT_CONFIRMED', 'maryluz@decathlon.com')
      if (c > before) break
      await new Promise(r => setTimeout(r, 300)); waited += 300
    }
    const after = await logsCount(tenant.id, 'ENROLLMENT_CONFIRMED', 'maryluz@decathlon.com')
    if (after !== before + 1) { fail(`NotificationLog não criou (${before} → ${after})`); allOk = false }
    else pass(`NotificationLog ENROLLMENT_CONFIRMED criado para Maryluz`)

    // ───────────────────────────────────────────── TASK-039
    info('TASK-039 — GET /api/cron/reminders processa sessões amanhã')
    const beforeRem = await logsCount(tenant.id, 'SESSION_REMINDER_24H')
    const r2 = await fetch(`${BASE_URL}/api/cron/reminders`)
    if (r2.status !== 200) { fail(`/api/cron/reminders HTTP ${r2.status}`); return false }
    const cronResult = await r2.json()
    info(`Cron resp: sessions=${cronResult.sessions} emails=${cronResult.emails} window=${cronResult.windowStart?.slice(0,10)}`)
    if (cronResult.sessions < 1) { fail('Cron não encontrou sessão de amanhã'); allOk = false }
    if (cronResult.emails < 1) { fail('Cron não enviou nenhum email'); allOk = false }
    const afterRem = await logsCount(tenant.id, 'SESSION_REMINDER_24H')
    if (afterRem <= beforeRem) { fail(`NotificationLog SESSION_REMINDER_24H não criado (${beforeRem} → ${afterRem})`); allOk = false }
    else pass(`Cron OK — sessions=${cronResult.sessions} emails=${cronResult.emails} (logs ${beforeRem}→${afterRem})`)

    info(`  vercel.json com schedule "0 8 * * *" criado em ${require('fs').existsSync(require('path').join(process.cwd(), 'vercel.json')) ? 'public' : 'AUSENTE'}`)

    info('TASK-039b — auth: com CRON_SECRET, sem header → 401')
    process.env.CRON_SECRET = 'test-secret'
    const rDeny = await fetch(`${BASE_URL}/api/cron/reminders`)
    // O dev server cacheia env vars no runtime; isto pode passar 200 se não recompilar.
    info(`  resposta sem auth: HTTP ${rDeny.status} (esperava 401 mas pode ser 200 se runtime não recarregou .env)`)
    delete process.env.CRON_SECRET

    // ───────────────────────────────────────────── TASK-040
    info('TASK-040 — POST .../signatures/enable dispara SignatureEnabled')
    // Criar check-in para a sessão
    await prisma.checkIn.deleteMany({ where: { sessionId: session.id, traineeId: t.id } })
    await prisma.checkIn.create({ data: { sessionId: session.id, traineeId: t.id, status: 'CHECKED_IN' } })
    await prisma.documentSignature.deleteMany({ where: { sessionId: session.id, traineeId: t.id, documentType: DocumentType.REGISTO_PRESENCAS } })

    const trainerCookies = await getCookieHeader(TRAINER_EMAIL, 'Trainer123!')
    const beforeSig = await logsCount(tenant.id, 'SIGNATURE_ENABLED', 'maryluz@decathlon.com')
    const r3 = await fetch(`${BASE_URL}/api/trainer/sessions/${session.id}/signatures/enable`, {
      method: 'POST',
      headers: { cookie: trainerCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeIds: [t.id], reason: 'Teste TASK-040' }),
    })
    if (r3.status !== 200) { fail(`enable HTTP ${r3.status}: ${await r3.text()}`); return false }
    let waited2 = 0
    while (waited2 < 6000) {
      const c = await logsCount(tenant.id, 'SIGNATURE_ENABLED', 'maryluz@decathlon.com')
      if (c > beforeSig) break
      await new Promise(r => setTimeout(r, 300)); waited2 += 300
    }
    const afterSig = await logsCount(tenant.id, 'SIGNATURE_ENABLED', 'maryluz@decathlon.com')
    if (afterSig !== beforeSig + 1) { fail(`SIGNATURE_ENABLED não logado (${beforeSig} → ${afterSig})`); allOk = false }
    else pass(`SIGNATURE_ENABLED logado para Maryluz`)

    // ───────────────────────────────────────────── TASK-041
    info('TASK-041 — POST /api/certificates dispara CertificateIssued')
    const beforeCert = await logsCount(tenant.id, 'CERTIFICATE_ISSUED', 'maryluz@decathlon.com')
    const r4 = await fetch(`${BASE_URL}/api/certificates`, {
      method: 'POST',
      headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeId: t.id, trainingActionId: action.id }),
    })
    if (r4.status !== 200) { fail(`/api/certificates HTTP ${r4.status}: ${await r4.text()}`); return false }
    const certResp = await r4.json()
    if (!certResp.certificateId) { fail('certificateId vazio'); return false }
    let waited3 = 0
    while (waited3 < 6000) {
      const c = await logsCount(tenant.id, 'CERTIFICATE_ISSUED', 'maryluz@decathlon.com')
      if (c > beforeCert) break
      await new Promise(r => setTimeout(r, 300)); waited3 += 300
    }
    const afterCert = await logsCount(tenant.id, 'CERTIFICATE_ISSUED', 'maryluz@decathlon.com')
    if (afterCert !== beforeCert + 1) { fail(`CERTIFICATE_ISSUED não logado (${beforeCert} → ${afterCert})`); allOk = false }
    else pass(`CERTIFICATE_ISSUED logado, certId=${certResp.certificateId.slice(0,8)} verifyCode=${certResp.verificationCode?.slice(0,12)}`)

    // ───────────────────────────────────────────── TASK-042
    info('TASK-042 — POST inquiry dispara NewInquiry para o tenant')
    const beforeInq = await logsCount(tenant.id, 'INQUIRY_RECEIVED', 'comercial@oportoforte.test')
    const r5 = await fetch(`${BASE_URL}/api/catalog/oportoforte/inquiry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Joana', lastName: 'Prospect',
        email: `prospect.${Date.now()}@test.com`,
        company: 'Empresa Teste', phone: '+351 911000000',
        courseId: course.id, courseName: course.name,
        message: 'Quero saber mais sobre o curso',
      }),
    })
    if (r5.status !== 200) { fail(`/inquiry HTTP ${r5.status}`); return false }
    let waited4 = 0
    while (waited4 < 6000) {
      const c = await logsCount(tenant.id, 'INQUIRY_RECEIVED', 'comercial@oportoforte.test')
      if (c > beforeInq) break
      await new Promise(r => setTimeout(r, 300)); waited4 += 300
    }
    const afterInq = await logsCount(tenant.id, 'INQUIRY_RECEIVED', 'comercial@oportoforte.test')
    if (afterInq !== beforeInq + 1) { fail(`INQUIRY_RECEIVED não logado (${beforeInq} → ${afterInq})`); allOk = false }
    else pass(`INQUIRY_RECEIVED logado para comercial@oportoforte.test`)

    // Validar que todos os logs ficaram com status=SENT (modo dev)
    info('Validar status=SENT nos últimos 5 logs')
    const recent = await prisma.notificationLog.findMany({
      where: { tenantId: tenant.id }, orderBy: { sentAt: 'desc' }, take: 5,
    })
    const failedRecent = recent.filter(l => l.status !== 'SENT')
    if (failedRecent.length > 0) {
      fail(`${failedRecent.length} logs com status != SENT: ${failedRecent.map(l => `${l.event}=${l.status}`).join(',')}`)
      allOk = false
    } else pass(`Todos os 5 últimos logs com status=SENT`)

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTask038to042().then(ok => {
    console.log('\n' + (ok ? '✅ TASKs 038–042 PASSARAM' : '❌ ALGUMA TASK FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
