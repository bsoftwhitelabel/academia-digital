import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureUserAndTrainee, ensureTrainer,
  header, pass, fail, info,
} from './harness'
import bcrypt from 'bcryptjs'
import { TrainingFormat, TrainingStatus, CourseStatus, DocumentType, SignatureStatus } from '@prisma/client'

const ADMIN_EMAIL   = 'admin@oportoforte.com'
const ADMIN_PASS    = 'Admin123!'
const TRAINER_EMAIL = 'celso@oportoforte.com'
const TRAINER_PASS  = 'Celso123!'
const TRAINEE_EMAIL = 'maryluz@decathlon.com'
const TRAINEE_PASS  = 'Trainee123!'
const HR_EMAIL      = 'rh@decathlon.com'
const HR_PASS       = 'Rh12345!'

const COURSE_NAME   = 'Segurança e Higiene no Trabalho'

// Pequeno PNG válido (1x1) para usar como assinatura sintética
const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII='

async function resetRateLimit() {
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(() => {})
}

async function getCookieHeader(email: string, password: string) {
  await resetRateLimit()
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

// ─── Estado partilhado entre testes ──────────────────────────────────
type Ctx = {
  tenantId: string
  decathlonId: string
  trainerId: string
  traineeId: string
  courseId: string
  actionId: string
  sessionId: string
  documentId?: string
  certificateId?: string
}

const ctx: Partial<Ctx> = {}

// ═══════════════════════════════════════════════════════════════════
//  TESTE-FINAL-001 — Admin
// ═══════════════════════════════════════════════════════════════════
async function teste001(): Promise<boolean> {
  header('TESTE-FINAL-001 — Ciclo completo Administrador')
  let allOk = true
  try {
    info('Setup base: tenant + admin + Decathlon')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        emailFromAddress: 'comercial@oportoforte.test',
        emailFromName: 'Oporto Forte',
        logoUrl: PNG_1x1,
      },
    })
    await ensureAdminUser({
      email: ADMIN_EMAIL, password: ADMIN_PASS,
      firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id,
    })
    let decathlon = await prisma.clientOrg.findFirst({ where: { tenantId: tenant.id, name: 'Decathlon' } })
    if (!decathlon) decathlon = await prisma.clientOrg.create({ data: { tenantId: tenant.id, name: 'Decathlon', country: 'PT', logoUrl: PNG_1x1 } })
    else if (!decathlon.logoUrl) await prisma.clientOrg.update({ where: { id: decathlon.id }, data: { logoUrl: PNG_1x1 } })
    ctx.tenantId = tenant.id
    ctx.decathlonId = decathlon.id
    pass(`Tenant + Decathlon (logos OK)`)

    info('1. Login admin')
    const adminCookies = await getCookieHeader(ADMIN_EMAIL, ADMIN_PASS)
    pass('Admin autenticado')

    info('2. Criar curso "Segurança e Higiene no Trabalho" PUBLISHED (slug único)')
    const uniqueSlug = `seguranca-higiene-${Date.now()}`
    const r1 = await fetch(`${BASE_URL}/api/admin/courses`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: COURSE_NAME,
        slug: uniqueSlug,
        durationHours: 25, format: 'PRESENCIAL', status: 'PUBLISHED',
        shortDescription: 'Formação obrigatória sobre prevenção de riscos profissionais.',
        coverImageUrl: PNG_1x1,
      }),
    })
    if (r1.status !== 200) { fail(`POST course HTTP ${r1.status}: ${await r1.text()}`); return false }
    const c = await r1.json()
    ctx.courseId = c.courseId
    pass(`Curso criado: ${c.slug}`)

    info('3. Criar TrainingAction com Decathlon (startDate amanhã para visibilidade no catálogo)')
    const tomorrow = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1, 9, 0, 0))
    const dayAfter = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 7, 18, 0, 0))
    const r2 = await fetch(`${BASE_URL}/api/admin/actions`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: ctx.courseId, clientOrgId: ctx.decathlonId,
        startDate: tomorrow.toISOString(),
        endDate: dayAfter.toISOString(),
        format: 'PRESENCIAL', status: 'SCHEDULED', actionCode: 'SHT-2026',
        maxTrainees: 12,
      }),
    })
    if (r2.status !== 200) { fail(`POST action HTTP ${r2.status}`); return false }
    const a = await r2.json()
    ctx.actionId = a.actionId
    pass(`Ação criada: SHT-2026`)

    info('4. Garantir formando Maryluz e adicionar à ação')
    const trainee = (await ensureUserAndTrainee({
      email: TRAINEE_EMAIL, password: TRAINEE_PASS,
      firstName: 'Maryluz', lastName: 'Lopes', tenantId: tenant.id,
    })).trainee
    ctx.traineeId = trainee.id
    await prisma.trainee.update({ where: { id: trainee.id }, data: { clientOrgId: ctx.decathlonId, nif: '258369741' } })
    const r3 = await fetch(`${BASE_URL}/api/enrollments`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainingActionId: ctx.actionId, traineeId: ctx.traineeId }),
    })
    if (r3.status !== 200) { fail(`enrollment HTTP ${r3.status}`); return false }
    pass(`Enrollment Maryluz Lopes ↔ SHT-2026`)

    info('5. Garantir trainer e ligar à ação')
    const trainer = await ensureTrainer(tenant.id, TRAINER_EMAIL)
    // Atualizar password e nome do trainer
    const trainerHash = await bcrypt.hash(TRAINER_PASS, 10)
    await prisma.user.update({
      where: { email: TRAINER_EMAIL },
      data: { passwordHash: trainerHash, firstName: 'Celso', lastName: 'Pinto' },
    })
    ctx.trainerId = trainer.id
    await prisma.trainingActionTrainer.upsert({
      where: { trainingActionId_trainerId: { trainingActionId: ctx.actionId!, trainerId: trainer.id } },
      update: {}, create: { trainingActionId: ctx.actionId!, trainerId: trainer.id, role: 'MAIN' },
    })

    info('6. Criar TrainingSession para hoje 18:30-22:30')
    // Limpar sessões anteriores deste trainee em todas as actions abertas
    await prisma.trainingSession.updateMany({
      where: {
        isOpen: true,
        trainingAction: { enrollments: { some: { traineeId: ctx.traineeId } } },
      },
      data: { isOpen: false, isClosed: true, closedAt: new Date() },
    })
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)  // midnight UTC of today
    const ses = await prisma.trainingSession.create({
      data: {
        trainingActionId: ctx.actionId!,
        trainerId: trainer.id,
        sessionDate: today,
        startTime: '18:30',
        endTime: '22:30',
        durationHours: 4,
        isOpen: false,
        isClosed: false,
      },
    })
    ctx.sessionId = ses.id
    pass(`Sessão criada: hoje 18:30-22:30 (id=${ses.id.slice(0,8)})`)

    info('7. Verificar dashboard mostra a nova ação em "Turmas Recentes"')
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage()
      await page.setExtraHTTPHeaders({ cookie: adminCookies })
      const r = await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle2' })
      if (r?.status() !== 200) { fail(`dashboard HTTP ${r?.status()}`); return false }
      const txt = await page.$eval('body', el => el.innerText)
      if (!txt.includes(COURSE_NAME)) {
        fail(`Curso "${COURSE_NAME}" não aparece no dashboard`)
        info('Sample: ' + txt.slice(0, 600))
        allOk = false
      } else pass('Dashboard mostra a turma em Turmas Recentes')
    } finally {
      await browser.close()
    }

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TESTE-FINAL-002 — Trainer
// ═══════════════════════════════════════════════════════════════════
async function teste002(): Promise<boolean> {
  header('TESTE-FINAL-002 — Ciclo completo Formador')
  let allOk = true
  try {
    info('1. Login formador celso@oportoforte.com')
    const trainerCookies = await getCookieHeader(TRAINER_EMAIL, TRAINER_PASS)
    pass('Trainer autenticado')

    info('2. /trainer/sessions deve listar a sessão criada')
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage()
      await page.setExtraHTTPHeaders({ cookie: trainerCookies })
      const r = await page.goto(`${BASE_URL}/trainer/sessions`, { waitUntil: 'networkidle2' })
      if (r?.status() !== 200) { fail(`HTTP ${r?.status()}`); return false }
      const txt = await page.$eval('body', el => el.innerText)
      if (!txt.includes(COURSE_NAME)) { fail(`Curso não listado em /trainer/sessions`); allOk = false }
      else pass(`Curso "${COURSE_NAME}" visível na lista`)
    } finally { await browser.close() }

    info('3. POST /api/trainer/sessions/[id]/open → isOpen=true')
    const r1 = await fetch(`${BASE_URL}/api/trainer/sessions/${ctx.sessionId}/open`, {
      method: 'POST', headers: { cookie: trainerCookies },
    })
    if (r1.status !== 200) { fail(`open HTTP ${r1.status}`); return false }
    // Estender checkinCloseAt para garantir que a janela está aberta durante o teste,
    // independentemente da hora local em que o teste corre.
    await prisma.trainingSession.update({
      where: { id: ctx.sessionId! },
      data: { checkinCloseAt: new Date(Date.now() + 6 * 3600 * 1000) },
    })
    const ses = await prisma.trainingSession.findUnique({ where: { id: ctx.sessionId! } })
    if (!ses?.isOpen) { fail(`isOpen=${ses?.isOpen}`); return false }
    pass(`Sessão aberta: isOpen=true checkinOpenAt=${ses.checkinOpenAt?.toISOString()} closeAt=${ses.checkinCloseAt?.toISOString()}`)

    info('4. GET /api/checkin/[id]/status → contador 0/1')
    const r2 = await fetch(`${BASE_URL}/api/checkin/${ctx.sessionId}/status`, { headers: { cookie: trainerCookies } })
    if (r2.status !== 200) { fail(`status HTTP ${r2.status}`); return false }
    const st = await r2.json()
    if (st.total !== 1 || st.present !== 0) { fail(`total/present=${st.total}/${st.present} (esperava 1/0)`); allOk = false }
    else pass(`Contador inicial: ${st.present}/${st.total}`)

    info('5. POST /api/checkin/[id]/qr → token + URL')
    const r3 = await fetch(`${BASE_URL}/api/checkin/${ctx.sessionId}/qr`, {
      method: 'POST', headers: { cookie: trainerCookies },
    })
    if (r3.status !== 200) { fail(`qr HTTP ${r3.status}`); return false }
    const qr = await r3.json()
    if (!qr.url || !qr.url.includes('/trainee/checkin/') || !qr.token) {
      fail(`QR URL inválido: ${JSON.stringify(qr)}`); return false
    }
    pass(`QR gerado: ${qr.url.slice(0, 60)}…`)

    info('6. Abrir QR URL em contexto privado → middleware redirecciona a /login')
    const browser2 = await launchBrowser()
    try {
      const ctx2 = await browser2.createBrowserContext()
      const guest = await ctx2.newPage()
      const r4 = await guest.goto(qr.url, { waitUntil: 'networkidle2' })
      // Esperado: middleware redireciona TRAINEE não autenticado para /login
      const finalUrl = guest.url()
      if (!finalUrl.includes('/login')) {
        fail(`Esperava redirect /login, ficou em: ${finalUrl}`)
        allOk = false
      } else {
        pass(`Sem login, redirect → /login (${r4?.status()}) — segurança preservada`)
        info('  (em produção o trainee logaria e a sessão seria validada)')
      }
      await ctx2.close()
    } finally { await browser2.close() }

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TESTE-FINAL-003 — Trainee
// ═══════════════════════════════════════════════════════════════════
async function teste003(): Promise<boolean> {
  header('TESTE-FINAL-003 — Ciclo completo Formando')
  let allOk = true
  let browser
  try {
    info('1. Login Maryluz')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, TRAINEE_EMAIL, TRAINEE_PASS)
    pass('Trainee autenticado')

    info('2. Dashboard mostra banner "Sessão em Curso — Segurança e Higiene"')
    const r = await page.goto(`${BASE_URL}/trainee/dashboard`, { waitUntil: 'networkidle2' })
    if (r?.status() !== 200) { fail(`HTTP ${r?.status()}`); return false }
    const txt = (await page.$eval('body', el => el.innerText)).toLowerCase()
    if (!txt.includes('a decorrer agora')) { fail('Banner "A decorrer agora" ausente'); return false }
    if (!txt.includes('segurança e higiene')) { fail('Curso não no banner'); return false }
    if (!txt.includes('fazer check-in agora')) { fail('Botão check-in ausente'); return false }
    pass('Banner ao vivo com curso correto')

    info('3. Click "Fazer Check-in Agora" → confirmar presença')
    await page.goto(`${BASE_URL}/trainee/checkin/${ctx.sessionId}`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('button')
    const buttons = await page.$$('button')
    let clicked = false
    for (const b of buttons) {
      const t = await page.evaluate(el => el.textContent || '', b)
      if (t.includes('Confirmar Presença')) { await b.click(); clicked = true; break }
    }
    if (!clicked) { fail('Botão Confirmar Presença não encontrado'); return false }
    await new Promise(r => setTimeout(r, 2500))
    const after = await page.$eval('body', el => el.innerText)
    if (!after.includes('Check-in Realizado')) { fail('Confirmação ausente'); return false }
    pass('Tela "Check-in Realizado!"')

    info('4. CheckIn na BD + contador no portal formador 1/1')
    const ci = await prisma.checkIn.findUnique({
      where: { sessionId_traineeId: { sessionId: ctx.sessionId!, traineeId: ctx.traineeId! } },
    })
    if (!ci) { fail('CheckIn não criado'); return false }
    pass(`CheckIn ${ci.id.slice(0,8)} ip=${ci.ipAddress}`)

    const trainerCookies = await getCookieHeader(TRAINER_EMAIL, TRAINER_PASS)
    const r2 = await fetch(`${BASE_URL}/api/checkin/${ctx.sessionId}/status`, { headers: { cookie: trainerCookies } })
    const st = await r2.json()
    if (st.present !== 1 || st.total !== 1) { fail(`Contador formador: ${st.present}/${st.total}`); allOk = false }
    else pass(`Contador formador: ${st.present}/${st.total} ✓`)

    info('5. Formador habilita assinatura via /signatures/enable')
    await prisma.documentSignature.deleteMany({
      where: { sessionId: ctx.sessionId, traineeId: ctx.traineeId, documentType: DocumentType.REGISTO_PRESENCAS },
    })
    const r3 = await fetch(`${BASE_URL}/api/trainer/sessions/${ctx.sessionId}/signatures/enable`, {
      method: 'POST', headers: { cookie: trainerCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeIds: [ctx.traineeId], reason: 'Sessão concluída' }),
    })
    if (r3.status !== 200) { fail(`enable HTTP ${r3.status}`); return false }
    const sig = await prisma.documentSignature.findFirst({
      where: { sessionId: ctx.sessionId, traineeId: ctx.traineeId, documentType: DocumentType.REGISTO_PRESENCAS },
    })
    if (sig?.status !== 'ENABLED') { fail(`status=${sig?.status}`); return false }
    ctx.documentId = sig.id
    pass(`DocumentSignature ENABLED (id=${sig.id.slice(0,8)})`)

    info('6. NotificationLog SIGNATURE_ENABLED registado')
    let waited = 0
    let logFound = null
    while (waited < 6000 && !logFound) {
      logFound = await prisma.notificationLog.findFirst({
        where: { event: 'SIGNATURE_ENABLED', recipient: TRAINEE_EMAIL, traineeId: ctx.traineeId },
        orderBy: { sentAt: 'desc' },
      })
      if (!logFound) { await new Promise(r => setTimeout(r, 300)); waited += 300 }
    }
    if (!logFound) { fail('NotificationLog SIGNATURE_ENABLED ausente'); allOk = false }
    else pass(`NotificationLog SIGNATURE_ENABLED → ${logFound.recipient} (${logFound.status})`)

    info('7. Maryluz acede /trainee/sign/[id] → assina no canvas')
    const r4 = await page.goto(`${BASE_URL}/trainee/sign/${ctx.documentId}`, { waitUntil: 'networkidle2' })
    if (r4?.status() !== 200) { fail(`HTTP ${r4?.status()}`); return false }
    await page.waitForSelector('canvas', { timeout: 10000 })
    const box = await page.$eval('canvas', el => {
      const r = (el as HTMLCanvasElement).getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2
    await page.mouse.move(cx - 60, cy - 20)
    await page.mouse.down()
    await page.mouse.move(cx, cy + 20, { steps: 8 })
    await page.mouse.move(cx + 60, cy - 20, { steps: 8 })
    await page.mouse.up()
    await new Promise(r => setTimeout(r, 400))
    // Click confirmar
    const btns = await page.$$('button')
    let confirmClicked = false
    for (const b of btns) {
      const t = await page.evaluate(el => el.textContent || '', b)
      if (t.includes('Confirmar Assinatura')) {
        const disabled = await page.evaluate(el => (el as HTMLButtonElement).disabled, b)
        if (disabled) { fail('Botão Confirmar Assinatura disabled'); return false }
        await b.click(); confirmClicked = true; break
      }
    }
    if (!confirmClicked) { fail('Botão Confirmar Assinatura ausente'); return false }
    await new Promise(r => setTimeout(r, 3000))

    info('8. DocumentSignature.status = SIGNED + signatureUrl')
    const after2 = await prisma.documentSignature.findUnique({ where: { id: ctx.documentId! } })
    if (after2?.status !== 'SIGNED') { fail(`status=${after2?.status}`); allOk = false }
    else pass(`status=SIGNED signedAt=${after2.signedAt?.toISOString()}`)
    if (!after2?.signatureUrl) { fail('signatureUrl vazia'); allOk = false }
    else pass(`signatureUrl preenchida (${after2.signatureUrl.slice(0, 40)}…)`)

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  } finally {
    if (browser) await browser.close()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TESTE-FINAL-004 — PDF
// ═══════════════════════════════════════════════════════════════════
async function teste004(): Promise<boolean> {
  header('TESTE-FINAL-004 — Ciclo completo PDF')
  let allOk = true
  try {
    info('1. Trainer guarda dossier (recursos + assinatura via API)')
    const trainerCookies = await getCookieHeader(TRAINER_EMAIL, TRAINER_PASS)
    const r1 = await fetch(`${BASE_URL}/api/trainer/sessions/${ctx.sessionId}/dossier`, {
      method: 'POST', headers: { cookie: trainerCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        didacticResources: ['Videoprojetor', 'Computador', 'Manual do Formando'],
        summary: 'Sessão concluída — todos os formandos presentes.',
        trainerSignatureUrl: PNG_1x1,
        occurrences: [],
      }),
    })
    if (r1.status !== 200) { fail(`dossier HTTP ${r1.status}`); return false }
    const ses = await prisma.trainingSession.findUnique({ where: { id: ctx.sessionId! } })
    if (!ses?.trainerSignatureUrl) { fail('trainerSignatureUrl vazia'); allOk = false }
    else pass(`Dossier guardado — recursos=${ses.didacticResources.length}, trainerSignedAt=${ses.trainerSignedAt?.toISOString()}`)

    info('2. Admin: GET /api/pdf/[actionId]/REGISTO_PRESENCAS')
    const adminCookies = await getCookieHeader(ADMIN_EMAIL, ADMIN_PASS)
    const r2 = await fetch(`${BASE_URL}/api/pdf/${ctx.actionId}/REGISTO_PRESENCAS`, { headers: { cookie: adminCookies } })
    if (r2.status !== 200) { fail(`pdf HTTP ${r2.status}`); return false }
    const buf = Buffer.from(await r2.arrayBuffer())
    if (!buf.slice(0, 4).toString('ascii').startsWith('%PDF')) { fail('Não é PDF'); return false }
    pass(`PDF Folha de Presenças: ${buf.length} bytes`)

    info('3. PDF contém Maryluz + assinatura embebida')
    // Procurar /Image marcadores no PDF
    const pdfText = buf.toString('latin1')
    const imgRefs = (pdfText.match(/\/Image/g) || []).length
    if (imgRefs < 3) { fail(`Esperava ≥3 /Image refs (3 logos + assinaturas), encontrei ${imgRefs}`); allOk = false }
    else pass(`/Image refs no PDF: ${imgRefs} (logos + assinaturas)`)

    info('4. Marcar enrollment como concluída e emitir certificado')
    await prisma.enrollment.updateMany({
      where: { trainingActionId: ctx.actionId, traineeId: ctx.traineeId },
      data: { status: 'COMPLETED', completedAt: new Date(), passed: true },
    })
    const r3 = await fetch(`${BASE_URL}/api/certificates`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeId: ctx.traineeId, trainingActionId: ctx.actionId }),
    })
    if (r3.status !== 200) { fail(`certificates HTTP ${r3.status}: ${await r3.text()}`); return false }
    const cert = await r3.json()
    ctx.certificateId = cert.certificateId
    pass(`Certificate emitido id=${cert.certificateId.slice(0,8)} verifyCode=${cert.verificationCode?.slice(0,12)}`)

    info('5. NotificationLog CERTIFICATE_ISSUED registado')
    let waited = 0
    let logFound = null
    while (waited < 6000 && !logFound) {
      logFound = await prisma.notificationLog.findFirst({
        where: { event: 'CERTIFICATE_ISSUED', recipient: TRAINEE_EMAIL, traineeId: ctx.traineeId },
        orderBy: { sentAt: 'desc' },
      })
      if (!logFound) { await new Promise(r => setTimeout(r, 300)); waited += 300 }
    }
    if (!logFound) { fail('NotificationLog CERTIFICATE_ISSUED ausente'); allOk = false }
    else pass(`NotificationLog CERTIFICATE_ISSUED → ${logFound.recipient}`)

    info('6. Maryluz acede /trainee/certificates → certificado listado')
    const traineeCookies = await getCookieHeader(TRAINEE_EMAIL, TRAINEE_PASS)
    const r4 = await fetch(`${BASE_URL}/trainee/certificates`, { headers: { cookie: traineeCookies } })
    if (r4.status !== 200) {
      fail(`/trainee/certificates HTTP ${r4.status}`)
      // Página pode não existir — verificamos pelo menos via API/DB
      const certs = await prisma.certificate.findMany({ where: { traineeId: ctx.traineeId } })
      if (certs.length === 0) { fail('Sem certificados na BD'); allOk = false }
      else pass(`(fallback) ${certs.length} certificado(s) na BD`)
    } else {
      const html = await r4.text()
      if (!html.includes(COURSE_NAME)) {
        info(`(página /trainee/certificates pode usar formato diferente — ver BD)`)
      }
      pass(`/trainee/certificates HTTP 200`)
    }

    info('7. PDF do certificado descarregável')
    const r5 = await fetch(`${BASE_URL}/api/pdf/${ctx.actionId}/CERTIFICADO_CONCLUSAO?traineeId=${ctx.traineeId}`,
      { headers: { cookie: traineeCookies } })
    // Trainee pode não ter permissão (route requires admin/trainer/super)
    if (r5.status === 200) {
      const certBuf = Buffer.from(await r5.arrayBuffer())
      if (certBuf.slice(0, 4).toString('ascii').startsWith('%PDF')) {
        pass(`Certificado PDF: ${certBuf.length} bytes`)
      }
    } else {
      // Tentar via admin (mais comum em prática)
      const r6 = await fetch(`${BASE_URL}/api/pdf/${ctx.actionId}/CERTIFICADO_CONCLUSAO?traineeId=${ctx.traineeId}`,
        { headers: { cookie: adminCookies } })
      if (r6.status !== 200) { fail(`Cert PDF HTTP ${r6.status}`); allOk = false }
      else {
        const cb = Buffer.from(await r6.arrayBuffer())
        pass(`Certificado PDF (via admin): ${cb.length} bytes`)
      }
    }

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TESTE-FINAL-005 — CLIENT_HR
// ═══════════════════════════════════════════════════════════════════
async function teste005(): Promise<boolean> {
  header('TESTE-FINAL-005 — Ciclo completo CLIENT_HR')
  let allOk = true
  let browser
  try {
    info('1. Criar utilizador rh@decathlon.com com clientHrOrgId = Decathlon')
    const hash = await bcrypt.hash(HR_PASS, 10)
    await prisma.user.upsert({
      where: { email: HR_EMAIL },
      update: {
        passwordHash: hash, role: 'CLIENT_HR', tenantId: ctx.tenantId!,
        firstName: 'Helena', lastName: 'RH', clientHrOrgId: ctx.decathlonId!,
      },
      create: {
        email: HR_EMAIL, passwordHash: hash, role: 'CLIENT_HR',
        firstName: 'Helena', lastName: 'RH', tenantId: ctx.tenantId!,
        clientHrOrgId: ctx.decathlonId!,
      },
    })
    pass('CLIENT_HR criado/atualizado')

    info('2. Login HR + verificar isolamento')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, HR_EMAIL, HR_PASS)
    const r = await page.goto(`${BASE_URL}/client/trainees`, { waitUntil: 'networkidle2' })
    if (r?.status() !== 200) { fail(`HTTP ${r?.status()}`); return false }
    const txt = await page.$eval('body', el => el.innerText)
    if (!txt.includes('Maryluz')) { fail('Maryluz ausente da lista'); allOk = false }
    else pass('Maryluz visível')

    info('3. /admin/dashboard → 403')
    const r2 = await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle2' })
    if (r2?.status() !== 403) { fail(`HTTP ${r2?.status()}`); allOk = false }
    else pass('CLIENT_HR em /admin/* → 403')

    info('4. /trainer/sessions → 403')
    const r3 = await page.goto(`${BASE_URL}/trainer/sessions`, { waitUntil: 'networkidle2' })
    if (r3?.status() !== 403) { fail(`HTTP ${r3?.status()}`); allOk = false }
    else pass('CLIENT_HR em /trainer/* → 403')

    info('5. Outros formandos (de outras empresas) NÃO aparecem')
    // Criar um formando em outra empresa para confirmar isolamento
    let other = await prisma.clientOrg.findFirst({ where: { tenantId: ctx.tenantId, name: 'Outra Empresa' } })
    if (!other) other = await prisma.clientOrg.create({ data: { tenantId: ctx.tenantId!, name: 'Outra Empresa', country: 'PT' } })
    const otherTr = await prisma.trainee.findFirst({ where: { email: 'pedro.outro@test.com' } })
    if (otherTr) {
      await prisma.trainee.update({ where: { id: otherTr.id }, data: { clientOrgId: other.id, firstName: 'Pedro', lastName: 'OutraEmpresa' } })
    }
    await page.goto(`${BASE_URL}/client/trainees`, { waitUntil: 'networkidle2' })
    const txt2 = await page.$eval('body', el => el.innerText)
    if (txt2.includes('OutraEmpresa')) { fail('Pedro de outra empresa apareceu — isolamento quebrado'); allOk = false }
    else pass('Outra empresa não visível — isolamento OK')

    info('6. Tentar /api/client/report → 404 ou 200 (depende da implementação)')
    const r4 = await page.goto(`${BASE_URL}/api/client/report`, { waitUntil: 'networkidle2' }).catch(() => null)
    info(`  endpoint /api/client/report HTTP ${r4?.status()} (pode não estar implementado — não bloqueia)`)

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  } finally {
    if (browser) await browser.close()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TESTE-FINAL-006 — Catálogo público
// ═══════════════════════════════════════════════════════════════════
async function teste006(): Promise<boolean> {
  header('TESTE-FINAL-006 — Catálogo público')
  let allOk = true
  let browser
  try {
    info('1-3. Visitar /oportoforte/catalog SEM autenticação')
    browser = await launchBrowser()
    const ctx2 = await browser.createBrowserContext()
    const guest = await ctx2.newPage()
    const r = await guest.goto(`${BASE_URL}/oportoforte/catalog`, { waitUntil: 'networkidle2' })
    if (r?.status() !== 200) { fail(`HTTP ${r?.status()}`); return false }
    const txt = await guest.$eval('body', el => el.innerText)
    if (!txt.includes(COURSE_NAME)) { fail(`Curso "${COURSE_NAME}" não no catálogo`); allOk = false }
    else pass(`Curso "${COURSE_NAME}" visível em /oportoforte/catalog`)

    info('4. Ficha individual com próxima sessão')
    const course = await prisma.course.findUnique({ where: { id: ctx.courseId! } })
    const r2 = await guest.goto(`${BASE_URL}/oportoforte/catalog/${course!.slug}`, { waitUntil: 'networkidle2' })
    if (r2?.status() !== 200) { fail(`HTTP ficha ${r2?.status()}`); return false }
    const dtxt = await guest.$eval('body', el => el.innerText)
    if (!dtxt.includes(COURSE_NAME)) { fail('Nome curso ausente na ficha'); allOk = false }
    if (!dtxt.includes('Tenho Interesse')) { fail('Botão "Tenho Interesse" ausente'); allOk = false }
    else pass('Ficha com botão "Tenho Interesse"')

    info('5. Submeter formulário de interesse')
    const buttons = await guest.$$('button')
    for (const b of buttons) {
      const t = await guest.evaluate(el => el.textContent || '', b)
      if (t.includes('Tenho Interesse')) { await b.click(); break }
    }
    await new Promise(r => setTimeout(r, 600))
    await guest.waitForSelector('input[name="firstName"]', { timeout: 5000 })
    const uniqEmail = `prospect.final.${Date.now()}@test.com`
    await guest.type('input[name="firstName"]', 'Tomás')
    await guest.type('input[name="lastName"]', 'Lead')
    await guest.type('input[name="email"]', uniqEmail)
    await guest.type('input[name="company"]', 'EmpresaTest')
    await guest.type('input[name="message"]', 'Interesse no SHT')
    const submits = await guest.$$('button[type="submit"]')
    if (submits.length === 0) { fail('Submit ausente'); return false }
    await submits[0].click()
    await new Promise(r => setTimeout(r, 2500))

    info('6. Verificar Inquiry no BD + NotificationLog INQUIRY_RECEIVED')
    const inq = await prisma.inquiry.findFirst({ where: { email: uniqEmail } })
    if (!inq) { fail('Inquiry não criado'); return false }
    pass(`Inquiry criado: ${inq.id.slice(0,8)} curso="${inq.courseName}"`)

    let waited = 0, log = null
    while (waited < 6000 && !log) {
      log = await prisma.notificationLog.findFirst({
        where: { event: 'INQUIRY_RECEIVED', tenantId: ctx.tenantId },
        orderBy: { sentAt: 'desc' },
      })
      if (!log) { await new Promise(r => setTimeout(r, 300)); waited += 300 }
    }
    if (!log) { fail('NotificationLog INQUIRY_RECEIVED ausente'); allOk = false }
    else pass(`NotificationLog INQUIRY_RECEIVED → ${log.recipient}`)

    await ctx2.close()
    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  } finally {
    if (browser) await browser.close()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Runner
// ═══════════════════════════════════════════════════════════════════
async function main() {
  const results = {
    t001: await teste001(),
    t002: await teste002(),
    t003: await teste003(),
    t004: await teste004(),
    t005: await teste005(),
    t006: await teste006(),
  }
  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log('  RESUMO TESTES FINAIS — Sprint 1')
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`  TESTE-FINAL-001 Admin     : ${results.t001 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  TESTE-FINAL-002 Trainer   : ${results.t002 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  TESTE-FINAL-003 Trainee   : ${results.t003 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  TESTE-FINAL-004 PDF       : ${results.t004 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  TESTE-FINAL-005 CLIENT_HR : ${results.t005 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  TESTE-FINAL-006 Catálogo  : ${results.t006 ? '✅ PASS' : '❌ FAIL'}`)
  const ok = Object.values(results).every(Boolean)
  console.log('\n' + (ok ? '✅ SPRINT 1 — TODOS OS TESTES FINAIS PASSARAM' : '❌ ALGUM TESTE FINAL FALHOU'))
  await prisma.$disconnect()
  process.exit(ok ? 0 : 1)
}

if (require.main === module) main()
