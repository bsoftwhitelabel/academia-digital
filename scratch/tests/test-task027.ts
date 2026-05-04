import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureTrainer,
  header, pass, fail, info,
} from './harness'
import { TrainingFormat, TrainingStatus, CourseStatus } from '@prisma/client'

const TRAINER_EMAIL = 'trainer.test@oportoforte.com'
const TRAINER_PASSWORD = 'Trainer123!'

async function setupSessions(tenantId: string, trainerId: string) {
  // Limpar dados anteriores ligados a este trainer
  const links = await prisma.trainingActionTrainer.findMany({ where: { trainerId } })
  const actionIds = links.map(l => l.trainingActionId)
  if (actionIds.length > 0) {
    await prisma.checkIn.deleteMany({ where: { session: { trainingActionId: { in: actionIds } } } })
    await prisma.trainingSession.deleteMany({ where: { trainingActionId: { in: actionIds } } })
    await prisma.enrollment.deleteMany({ where: { trainingActionId: { in: actionIds } } })
    await prisma.trainingActionTrainer.deleteMany({ where: { trainingActionId: { in: actionIds } } })
    await prisma.trainingAction.deleteMany({ where: { id: { in: actionIds } } })
  }

  // Curso para a action
  const course = await prisma.course.upsert({
    where: { tenantId_slug: { tenantId, slug: 'task027-curso' } },
    update: {},
    create: {
      tenantId, name: 'Curso Task-027', slug: 'task027-curso',
      durationHours: 24, format: TrainingFormat.PRESENCIAL,
      status: CourseStatus.PUBLISHED,
    },
  })

  // 3 actions: scheduled (futuro), agendada hoje (para iniciar), em curso, concluída
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 7)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 3)

  const actions: any[] = []
  for (const [label, when, status] of [
    ['scheduled-future', tomorrow, TrainingStatus.SCHEDULED],
    ['scheduled-today', today, TrainingStatus.SCHEDULED],
    ['in-progress', today, TrainingStatus.IN_PROGRESS],
    ['completed', yesterday, TrainingStatus.COMPLETED],
  ] as const) {
    const a = await prisma.trainingAction.create({
      data: {
        tenantId, courseId: course.id, format: TrainingFormat.PRESENCIAL,
        startDate: when, endDate: when, status,
        actionCode: `T027-${label.slice(0, 8).toUpperCase()}`,
      },
    })
    await prisma.trainingActionTrainer.create({
      data: { trainingActionId: a.id, trainerId, role: 'MAIN' },
    })
    actions.push({ label, action: a, when })
  }

  // Sessions
  const sessions: any[] = []
  for (const { label, action, when } of actions) {
    const isOpen = label === 'in-progress'
    const isClosed = label === 'completed'
    const s = await prisma.trainingSession.create({
      data: {
        trainingActionId: action.id,
        trainerId,
        sessionDate: when,
        startTime: '09:00',
        endTime: '17:00',
        durationHours: 8,
        isOpen,
        isClosed,
        ...(isClosed ? { closedAt: when } : {}),
      },
    })
    sessions.push({ label, session: s })
  }
  return { course, sessions }
}

export async function runTask027(): Promise<boolean> {
  header('TASK-027 — Lista de sessões do formador')
  let browser
  try {
    info('1. Setup BD: tenant + formador + sessões em cada estado')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const trainer = await ensureTrainer(tenant.id, TRAINER_EMAIL)
    const { sessions } = await setupSessions(tenant.id, trainer.id)
    pass(`Setup OK — trainer=${trainer.id.slice(0,8)} sessões=${sessions.length}`)

    const futureSession = sessions.find((s: any) => s.label === 'scheduled-future')!.session
    const todaySession  = sessions.find((s: any) => s.label === 'scheduled-today')!.session
    const inProgress    = sessions.find((s: any) => s.label === 'in-progress')!.session
    const completed     = sessions.find((s: any) => s.label === 'completed')!.session

    info('2. Browser: login do formador')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, TRAINER_EMAIL, TRAINER_PASSWORD)
    // Login redireciona para /trainee/dashboard mas o middleware bloqueia (formador) → trainer manual
    info(`URL pós-login: ${page.url()}`)

    info('3. /trainer/sessions')
    const resp = await page.goto(`${BASE_URL}/trainer/sessions`, { waitUntil: 'networkidle2' })
    if (resp?.status() !== 200) {
      fail(`HTTP ${resp?.status()}`)
      return false
    }
    pass('Página carregou (HTTP 200)')

    info('4. Verificar tabs')
    const txt = await page.$eval('body', el => el.innerText)
    let allTabs = true
    for (const tab of ['Próximas', 'Em Curso', 'Concluídas', 'Histórico']) {
      if (txt.includes(tab)) pass(`  ✓ Tab "${tab}"`)
      else { fail(`  ✗ Tab "${tab}" ausente`); allTabs = false }
    }
    if (!allTabs) return false

    info('5. Mudar para tab "Em Curso" e procurar Continuar')
    // Clicar no trigger Em Curso
    const triggers = await page.$$('[data-slot="tabs-trigger"]')
    let clicked = false
    for (const tr of triggers) {
      const t = await page.evaluate((el: any) => el.textContent || '', tr)
      if (t.startsWith('Em Curso')) { await tr.click(); clicked = true; break }
    }
    if (!clicked) { fail('Não consegui clicar no tab Em Curso'); return false }
    await new Promise(r => setTimeout(r, 400))
    const continuarLink = await page.$(`a[href="/trainer/sessions/${inProgress.id}/attendance"]`)
    if (!continuarLink) {
      fail(`Link "Continuar" para sessão em curso não encontrado`)
      return false
    }
    pass('Botão "Continuar" presente para sessão em curso (após mudar de tab)')

    info('6. Mudar para tab "Concluídas" e verificar badge')
    for (const tr of triggers) {
      const t = await page.evaluate((el: any) => el.textContent || '', tr)
      if (t.startsWith('Concluídas')) { await tr.click(); break }
    }
    await new Promise(r => setTimeout(r, 400))
    const completedTxt = await page.$eval('body', el => el.innerText)
    if (!completedTxt.includes('Concluída')) { fail('Badge "Concluída" não aparece na tab Concluídas'); return false }
    pass('Badge "Concluída" visível')

    info('7. Voltar a Próximas → confirmar Iniciar Sessão')
    for (const tr of triggers) {
      const t = await page.evaluate((el: any) => el.textContent || '', tr)
      if (t.startsWith('Próximas')) { await tr.click(); break }
    }
    await new Promise(r => setTimeout(r, 400))
    const proximasTxt = await page.$eval('body', el => el.innerText)
    if (!proximasTxt.includes('Iniciar Sessão')) { fail('Botão "Iniciar Sessão" ausente'); return false }
    if (!proximasTxt.includes('Agendada')) { fail('Badge "Agendada" ausente'); return false }
    pass('Tab "Próximas" mostra Agendada + Iniciar Sessão')

    info('7. Validar API POST /api/trainer/sessions/[id]/open via fetch com cookies de formador')
    const cookies = await page.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const apiResp = await fetch(`${BASE_URL}/api/trainer/sessions/${futureSession.id}/open`, {
      method: 'POST', headers: { cookie: cookieHeader },
    })
    const apiData = await apiResp.json()
    if (apiResp.status !== 200) { fail(`API HTTP ${apiResp.status}: ${JSON.stringify(apiData)}`); return false }
    pass(`API open OK — isOpen=${apiData.isOpen} checkinOpenAt=${apiData.checkinOpenAt}`)

    info('8. Verificar BD: sessão futura → isOpen=true, checkinOpenAt~now, checkinCloseAt = endTime')
    const after = await prisma.trainingSession.findUnique({ where: { id: futureSession.id } })
    if (!after?.isOpen) { fail('isOpen != true'); return false }
    if (!after.checkinOpenAt) { fail('checkinOpenAt vazio'); return false }
    if (!after.checkinCloseAt) { fail('checkinCloseAt vazio'); return false }
    const closeHour = after.checkinCloseAt.getHours()
    if (closeHour !== 17) { fail(`checkinCloseAt hora=${closeHour} (esperava 17)`); return false }
    pass(`BD OK — isOpen=true checkinCloseAt=${after.checkinCloseAt.toISOString()}`)

    info('9. Bloqueio: formador X tenta abrir sessão de outro formador → 403')
    // Criar outra ação noutro trainer
    const anotherTrainerUserHash = 'irrelevant'
    const otherTrainerUser = await prisma.user.upsert({
      where: { email: 'other.trainer@oportoforte.com' },
      update: { tenantId: tenant.id, role: 'TRAINER' },
      create: { email: 'other.trainer@oportoforte.com', passwordHash: anotherTrainerUserHash,
                role: 'TRAINER', firstName: 'Other', lastName: 'Trainer', tenantId: tenant.id },
    })
    let otherTrainer = await prisma.trainer.findUnique({ where: { userId: otherTrainerUser.id } })
    if (!otherTrainer) {
      otherTrainer = await prisma.trainer.create({
        data: { tenantId: tenant.id, userId: otherTrainerUser.id, regions: ['Porto'] },
      })
    }
    const courseB = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'task027-other' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Curso Other', slug: 'task027-other',
                durationHours: 8, format: TrainingFormat.PRESENCIAL, status: CourseStatus.PUBLISHED },
    })
    const otherAction = await prisma.trainingAction.create({
      data: { tenantId: tenant.id, courseId: courseB.id, startDate: new Date(), endDate: new Date(),
              format: TrainingFormat.PRESENCIAL, status: TrainingStatus.SCHEDULED },
    })
    await prisma.trainingActionTrainer.create({
      data: { trainingActionId: otherAction.id, trainerId: otherTrainer.id, role: 'MAIN' },
    })
    const otherSession = await prisma.trainingSession.create({
      data: {
        trainingActionId: otherAction.id, trainerId: otherTrainer.id,
        sessionDate: new Date(), startTime: '09:00', endTime: '17:00', durationHours: 8,
        isOpen: false, isClosed: false,
      },
    })
    const forbidden = await fetch(`${BASE_URL}/api/trainer/sessions/${otherSession.id}/open`, {
      method: 'POST', headers: { cookie: cookieHeader },
    })
    if (forbidden.status !== 403) { fail(`Esperava 403, recebido ${forbidden.status}`); return false }
    pass('Formador alheio à sessão recebe 403 (autorização correta)')

    return true
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  } finally {
    if (browser) await browser.close()
  }
}

if (require.main === module) {
  runTask027().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-027 PASSOU' : '❌ TASK-027 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
