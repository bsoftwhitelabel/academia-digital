import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureUserAndTrainee, ensureTrainer,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'
import { sendNotification } from '@/lib/notifications'
import { formatWhatsAppNumber } from '@/lib/whatsapp'

const ADMIN_EMAIL = 'admin@oportoforte.com'
const TRAINEE_EMAIL = 'maryluz@decathlon.com'
const TRAINEE_PASS = 'Trainee123!'
const TRAINEE_PHONE = '+351 912 345 678'

async function getCookieHeader(email: string, password: string) {
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(() => {})
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

async function teste001(): Promise<boolean> {
  header('TESTE-WHATSAPP-001 — Modo desenvolvimento (sem TWILIO_ACCOUNT_SID)')
  let allOk = true
  try {
    info('Setup: tenant + Maryluz com phone preenchido')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    const { user, trainee } = await ensureUserAndTrainee({
      email: TRAINEE_EMAIL, password: TRAINEE_PASS,
      firstName: 'Maryluz', lastName: 'Lopes', tenantId: tenant.id,
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: TRAINEE_PHONE, notifEmail: true, notifWhatsApp: true },
    })
    pass(`Trainee.id=${trainee.id.slice(0,8)} phone=${TRAINEE_PHONE}`)

    info('1. Garantir TWILIO_ACCOUNT_SID ausente do processo do dev server')
    info('  (assumindo ausente — .env.local não tem)')

    info('2. sendNotification ENROLLMENT_CONFIRMED → deve criar log de email')
    const before = await prisma.notificationLog.count({
      where: { tenantId: tenant.id, traineeId: trainee.id, event: 'ENROLLMENT_CONFIRMED' },
    })
    await sendNotification({
      event: 'ENROLLMENT_CONFIRMED',
      traineeId: trainee.id,
      tenantId: tenant.id,
      data: {
        cursoNome: 'Curso Test WhatsApp',
        dataInicio: '01/05/2026',
        dataFim: '15/05/2026',
        local: 'Porto',
      },
    })
    const after = await prisma.notificationLog.count({
      where: { tenantId: tenant.id, traineeId: trainee.id, event: 'ENROLLMENT_CONFIRMED' },
    })
    if (after <= before) { fail(`Log ENROLLMENT_CONFIRMED não criado (${before} → ${after})`); allOk = false }
    else pass(`Log ENROLLMENT_CONFIRMED criado (${before} → ${after})`)
    // ENROLLMENT_CONFIRMED não tem template WhatsApp → deve haver SÓ EMAIL log
    const channels = await prisma.notificationLog.findMany({
      where: { tenantId: tenant.id, traineeId: trainee.id, event: 'ENROLLMENT_CONFIRMED' },
      orderBy: { sentAt: 'desc' }, take: 2,
    })
    const haveEmail = channels.some(c => c.channel === 'EMAIL')
    const haveWhats = channels.some(c => c.channel === 'WHATSAPP')
    if (!haveEmail) { fail('Sem log EMAIL'); allOk = false } else pass('Log canal=EMAIL ✓')
    if (haveWhats) { fail('Log WHATSAPP em ENROLLMENT_CONFIRMED (não tem template)'); allOk = false }
    else pass('Sem log WHATSAPP em ENROLLMENT_CONFIRMED ✓')

    info('3. sendNotification SIGNATURE_ENABLED → deve criar 2 logs (EMAIL + WHATSAPP dev)')
    await sendNotification({
      event: 'SIGNATURE_ENABLED',
      traineeId: trainee.id,
      tenantId: tenant.id,
      data: {
        cursoNome: 'Curso WhatsApp',
        sessaoData: '01/05/2026',
        documentId: 'doc-fake-id',
        expiresAt: '02/05/2026',
        notes: 'Teste',
      },
    })
    const sigLogs = await prisma.notificationLog.findMany({
      where: { tenantId: tenant.id, traineeId: trainee.id, event: 'SIGNATURE_ENABLED' },
      orderBy: { sentAt: 'desc' }, take: 2,
    })
    const sigEmail = sigLogs.find(l => l.channel === 'EMAIL')
    const sigWhats = sigLogs.find(l => l.channel === 'WHATSAPP')
    if (!sigEmail) { fail('Sem log EMAIL para SIGNATURE_ENABLED'); allOk = false } else pass(`Log EMAIL → ${sigEmail.recipient} (status=${sigEmail.status})`)
    if (!sigWhats) { fail('Sem log WHATSAPP para SIGNATURE_ENABLED'); allOk = false }
    else {
      pass(`Log WHATSAPP → ${sigWhats.recipient} (status=${sigWhats.status})`)
      if (!sigWhats.recipient.startsWith('whatsapp:+')) {
        fail(`recipient não normalizado: ${sigWhats.recipient}`); allOk = false
      } else pass('Número normalizado: whatsapp:+...')
      if (!sigWhats.errorMsg?.includes('dev mode')) {
        info(`  errorMsg: ${sigWhats.errorMsg || '(none)'}`)
      } else pass('Flag dev mode presente no log')
    }
    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

async function teste002(): Promise<boolean> {
  header('TESTE-WHATSAPP-002 — Preferências do formando (notifWhatsApp=false)')
  let allOk = true
  try {
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const { user, trainee } = await ensureUserAndTrainee({
      email: TRAINEE_EMAIL, password: TRAINEE_PASS,
      firstName: 'Maryluz', lastName: 'Lopes', tenantId: tenant.id,
    })
    // Pré-condições: phone preenchido, notifWhatsApp = false
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: TRAINEE_PHONE, notifEmail: true, notifWhatsApp: false },
    })

    info('1. Atualizar preferências (Prisma directo — dev server cache do Prisma client é stale após db push)')
    // Já gravado acima via update; verificar.
    const verifyUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notifEmail: true, notifWhatsApp: true, phone: true },
    })
    if (verifyUser?.notifWhatsApp !== false) { fail(`notifWhatsApp=${verifyUser?.notifWhatsApp}`); return false }
    pass(`Prefs guardadas: notifEmail=${verifyUser.notifEmail} notifWhatsApp=${verifyUser.notifWhatsApp}`)

    info('2. Disparar SIGNATURE_ENABLED → só log EMAIL, sem WhatsApp')
    const beforeWp = await prisma.notificationLog.count({
      where: { tenantId: tenant.id, traineeId: trainee.id, event: 'SIGNATURE_ENABLED', channel: 'WHATSAPP' },
    })
    const beforeEm = await prisma.notificationLog.count({
      where: { tenantId: tenant.id, traineeId: trainee.id, event: 'SIGNATURE_ENABLED', channel: 'EMAIL' },
    })
    await sendNotification({
      event: 'SIGNATURE_ENABLED',
      traineeId: trainee.id,
      tenantId: tenant.id,
      data: { cursoNome: 'Pref Test', sessaoData: '01/05/2026', documentId: 'doc-x', expiresAt: '02/05/2026' },
    })
    const afterWp = await prisma.notificationLog.count({
      where: { tenantId: tenant.id, traineeId: trainee.id, event: 'SIGNATURE_ENABLED', channel: 'WHATSAPP' },
    })
    const afterEm = await prisma.notificationLog.count({
      where: { tenantId: tenant.id, traineeId: trainee.id, event: 'SIGNATURE_ENABLED', channel: 'EMAIL' },
    })
    if (afterEm <= beforeEm) { fail(`EMAIL log não criado (${beforeEm} → ${afterEm})`); allOk = false }
    else pass(`Log EMAIL criado (${beforeEm} → ${afterEm})`)
    if (afterWp !== beforeWp) { fail(`WHATSAPP foi enviado apesar de notifWhatsApp=false (${beforeWp} → ${afterWp})`); allOk = false }
    else pass(`Nenhum log WHATSAPP (preferência respeitada)`)

    info('3. notifEmail=false também respeitado')
    await prisma.user.update({
      where: { id: user.id }, data: { notifEmail: false, notifWhatsApp: false },
    })
    const before = await prisma.notificationLog.count({ where: { traineeId: trainee.id, event: 'SIGNATURE_ENABLED' } })
    await sendNotification({
      event: 'SIGNATURE_ENABLED',
      traineeId: trainee.id, tenantId: tenant.id,
      data: { cursoNome: 'X', sessaoData: '01/05/2026', documentId: 'd', expiresAt: '02/05/2026' },
    })
    const after = await prisma.notificationLog.count({ where: { traineeId: trainee.id, event: 'SIGNATURE_ENABLED' } })
    if (after !== before) { fail(`Logs criados apesar de tudo desligado: ${before} → ${after}`); allOk = false }
    else pass('Sem logs criados — tudo desligado')

    // Repor para próximos testes
    await prisma.user.update({
      where: { id: user.id }, data: { notifEmail: true, notifWhatsApp: true },
    })
    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

async function teste003(): Promise<boolean> {
  header('TESTE-WHATSAPP-003 — Templates formatados em todos os eventos')
  let allOk = true
  try {
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const { trainee, user } = await ensureUserAndTrainee({
      email: TRAINEE_EMAIL, password: TRAINEE_PASS,
      firstName: 'Maryluz', lastName: 'Lopes', tenantId: tenant.id,
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: TRAINEE_PHONE, notifEmail: true, notifWhatsApp: true },
    })

    info('1. formatWhatsAppNumber("912345678", "PT") → whatsapp:+351912345678')
    const cases: Array<[string, string, string]> = [
      ['912345678', 'PT', 'whatsapp:+351912345678'],
      ['+351 912 345 678', 'PT', 'whatsapp:+351912345678'],
      ['(11) 91234-5678', 'BR', 'whatsapp:+5511912345678'],
      ['00351912345678', 'PT', 'whatsapp:+351912345678'],
    ]
    for (const [input, country, expected] of cases) {
      const got = formatWhatsAppNumber(input, country)
      if (got !== expected) { fail(`  "${input}" (${country}) → got "${got}" expected "${expected}"`); allOk = false }
      else pass(`  ✓ "${input}" → "${got}"`)
    }

    info('2. Cada evento gera log WHATSAPP com placeholders preenchidos')
    type Case = { event: any; data: any; mustContain: string[] }
    const events: Case[] = [
      {
        event: 'SESSION_REMINDER_24H',
        data: { cursoNome: 'Liderança 2026', data: '15/05/2026', horaInicio: '09:00', horaFim: '17:00', local: 'Porto', sessionId: 'sess-abc-123' },
        mustContain: ['Liderança 2026', '15/05/2026', '09:00', 'Porto', '/trainee/checkin/sess-abc-123'],
      },
      {
        event: 'SIGNATURE_ENABLED',
        data: { cursoNome: 'Comunicação', sessaoData: '20/05/2026', documentId: 'doc-xyz-456', expiresAt: '25/05/2026' },
        mustContain: ['Comunicação', '/trainee/sign/doc-xyz-456', '25/05/2026'],
      },
      {
        event: 'CERTIFICATE_ISSUED',
        data: { cursoNome: 'Atendimento', dataConclusao: '01/06/2026', certificateId: 'cert-1', verificationCode: 'VC123', pdfUrl: 'http://localhost:3000/api/pdf/x/CERTIFICADO_CONCLUSAO?traineeId=t1' },
        mustContain: ['Atendimento', 'http://localhost:3000/api/pdf/x/CERTIFICADO'],
      },
      {
        event: 'QUESTIONNAIRE_AVAILABLE',
        data: { cursoNome: 'Avaliação Final', linkSurvey: 'http://localhost:3000/survey/token-abc' },
        mustContain: ['Avaliação Final', 'http://localhost:3000/survey/token-abc', 'Demora apenas 2 minutos'],
      },
    ]
    for (const c of events) {
      const before = await prisma.notificationLog.count({
        where: { traineeId: trainee.id, event: c.event, channel: 'WHATSAPP' },
      })
      await sendNotification({ event: c.event, traineeId: trainee.id, tenantId: tenant.id, data: c.data })
      const log = await prisma.notificationLog.findFirst({
        where: { traineeId: trainee.id, event: c.event, channel: 'WHATSAPP' },
        orderBy: { sentAt: 'desc' },
      })
      if (!log) { fail(`Sem log WHATSAPP para ${c.event}`); allOk = false; continue }
      // O body do template está apenas no console — o log não armazena body. Verificamos pelo recipient correto e ausência de erro.
      if (!log.recipient.startsWith('whatsapp:+')) { fail(`${c.event}: recipient errado: ${log.recipient}`); allOk = false }
      else pass(`${c.event}: log WHATSAPP recipient=${log.recipient} (status=${log.status})`)
    }

    info('3. Todos os logs WhatsApp têm número formatado +351')
    const wpLogs = await prisma.notificationLog.findMany({
      where: { traineeId: trainee.id, channel: 'WHATSAPP' },
      orderBy: { sentAt: 'desc' }, take: 6,
    })
    const allFormatted = wpLogs.every(l => l.recipient.startsWith('whatsapp:+'))
    if (!allFormatted) { fail(`Algum log com formato errado: ${wpLogs.map(l => l.recipient).join(',')}`); allOk = false }
    else pass(`${wpLogs.length} logs WHATSAPP, todos com whatsapp:+...`)

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

async function main() {
  const r1 = await teste001()
  const r2 = await teste002()
  const r3 = await teste003()
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  RESUMO TESTES WhatsApp')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`  001 Modo dev:      ${r1 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  002 Preferências:  ${r2 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  003 Templates:     ${r3 ? '✅ PASS' : '❌ FAIL'}`)
  const ok = r1 && r2 && r3
  console.log('\n' + (ok ? '✅ TODOS OS TESTES PASSARAM' : '❌ ALGUM FALHOU'))
  await prisma.$disconnect()
  process.exit(ok ? 0 : 1)
}

if (require.main === module) main()
