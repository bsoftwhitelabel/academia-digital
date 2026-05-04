import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureTrainer, ensureUserAndTrainee,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = 'admin@oportoforte.com'
const HR_EMAIL = 'hr.decathlon@test.com'
const HR_PASS = 'Hr12345!'

async function getCookieHeader(email: string, password: string) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

export async function runPhase18(): Promise<boolean> {
  header('Fase 1.8 — TASK-044 a TASK-048')
  let browser
  let allOk = true
  try {
    info('Setup: tenant + admin + trainer + Decathlon ClientOrg + CLIENT_HR user')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({
      email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id,
    })
    await ensureTrainer(tenant.id)

    let decathlon = await prisma.clientOrg.findFirst({ where: { tenantId: tenant.id, name: 'Decathlon' } })
    if (!decathlon) decathlon = await prisma.clientOrg.create({ data: { tenantId: tenant.id, name: 'Decathlon', country: 'PT' } })

    let other = await prisma.clientOrg.findFirst({ where: { tenantId: tenant.id, name: 'Outra Empresa' } })
    if (!other) other = await prisma.clientOrg.create({ data: { tenantId: tenant.id, name: 'Outra Empresa', country: 'PT' } })

    // CLIENT_HR user com clientHrOrgId = Decathlon
    const hrHash = await bcrypt.hash(HR_PASS, 10)
    await prisma.user.upsert({
      where: { email: HR_EMAIL },
      update: {
        passwordHash: hrHash, role: 'CLIENT_HR', tenantId: tenant.id,
        firstName: 'Helena', lastName: 'RH', clientHrOrgId: decathlon.id, isActive: true,
      },
      create: {
        email: HR_EMAIL, passwordHash: hrHash, role: 'CLIENT_HR',
        firstName: 'Helena', lastName: 'RH', tenantId: tenant.id,
        clientHrOrgId: decathlon.id,
      },
    })

    // 1 trainee Decathlon e 1 outro
    const tDeca = (await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })).trainee
    await prisma.trainee.update({ where: { id: tDeca.id }, data: { clientOrgId: decathlon.id } })

    const tOther = (await ensureUserAndTrainee({
      email: 'pedro.outro@test.com', password: 'Trainee123!',
      firstName: 'Pedro', lastName: 'Outro', tenantId: tenant.id,
    })).trainee
    await prisma.trainee.update({ where: { id: tOther.id }, data: { clientOrgId: other.id } })

    pass(`Setup OK — Decathlon=${decathlon.id.slice(0,8)} HR=${HR_EMAIL}`)

    // ─────────────────────────────────────────── TASK-044 Dashboard
    info('TASK-044 — Dashboard admin: KPIs')
    const adminCookies = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    browser = await launchBrowser()
    const adminPage = await browser.newPage()
    await loginAs(adminPage, ADMIN_EMAIL, 'Admin123!')
    const r1 = await adminPage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle2' })
    if (r1?.status() !== 200) { fail(`/admin/dashboard HTTP ${r1?.status()}`); return false }
    await adminPage.waitForSelector('[data-testid="kpis"]', { timeout: 10000 })

    const kpisText = await adminPage.$eval('[data-testid="kpis"]', el => el.textContent || '')
    info(`KPIs: ${kpisText.replace(/\s+/g, ' ').slice(0, 200)}`)
    for (const lbl of ['Turmas Ativas','Docs Pendentes','Total Formandos','Taxa de Conclusão']) {
      if (!kpisText.includes(lbl)) { fail(`KPI "${lbl}" ausente`); allOk = false }
    }
    if (allOk) pass('4 KPIs renderizados')

    // ─────────────────────────────────────────── TASK-045 Curso novo + publicar
    info('TASK-045 — Criar curso com imagem + publicar via API')
    const cover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const r2 = await fetch(`${BASE_URL}/api/admin/courses`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Curso T045 ' + Date.now(),
        durationHours: 12, format: 'PRESENCIAL',
        shortDescription: 'Curso criado pelo teste TASK-045',
        coverImageUrl: cover,
        status: 'PUBLISHED',
        tags: ['novo', 'teste'],
      }),
    })
    if (r2.status !== 200) { fail(`POST /api/admin/courses HTTP ${r2.status}: ${await r2.text()}`); return false }
    const courseResp = await r2.json()
    info(`courseId=${courseResp.courseId.slice(0,8)} slug=${courseResp.slug}`)
    const created = await prisma.course.findUnique({ where: { id: courseResp.courseId } })
    if (created?.status !== 'PUBLISHED') { fail(`status=${created?.status}`); allOk = false } else pass('Curso PUBLISHED no BD')
    if (!created?.coverImageUrl?.startsWith('data:image/')) { fail('coverImageUrl não persistido'); allOk = false } else pass('coverImageUrl persistido')
    if (!created?.publishedAt) { fail('publishedAt vazio'); allOk = false } else pass(`publishedAt=${created.publishedAt.toISOString()}`)
    if (created?.slug?.includes('curso-t045')) pass(`slug auto-gerado: ${created.slug}`)
    else { fail(`slug inesperado: ${created?.slug}`); allOk = false }

    // Verificar que aparece no catálogo público
    const r3 = await fetch(`${BASE_URL}/oportoforte/catalog`)
    const html = await r3.text()
    if (html.includes(created!.name)) pass('Curso visível no catálogo público')
    else { fail('Curso não aparece em /oportoforte/catalog'); allOk = false }

    // ─────────────────────────────────────────── TASK-046 Action CRUD
    info('TASK-046 — Criar ação via API')
    const r4 = await fetch(`${BASE_URL}/api/admin/actions`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: courseResp.courseId, clientOrgId: decathlon.id,
        startDate: '2026-06-01', endDate: '2026-06-30',
        format: 'PRESENCIAL', status: 'SCHEDULED', actionCode: 'T046-DEC',
      }),
    })
    if (r4.status !== 200) { fail(`POST /api/admin/actions HTTP ${r4.status}`); allOk = false }
    else pass('Ação criada via API')

    info('TASK-046b — listagem /admin/actions')
    const r5 = await adminPage.goto(`${BASE_URL}/admin/actions`, { waitUntil: 'networkidle2' })
    if (r5?.status() !== 200) { fail(`HTTP ${r5?.status()}`); allOk = false }
    else {
      const txt = await adminPage.$eval('body', el => el.innerText)
      if (txt.includes('T046-DEC')) pass('Ação visível na lista')
      else { fail('Ação não visível na lista'); allOk = false }
    }

    // ─────────────────────────────────────────── TASK-047 Branding
    info('TASK-047 — PUT /api/admin/tenant/branding')
    const r6 = await fetch(`${BASE_URL}/api/admin/tenant/branding`, {
      method: 'PUT', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platformName: 'Academia Oporto Forte',
        primaryColor: '#0B2447',
        accentColor: '#C9A520',
        emailFromName: 'Oporto Forte',
        emailFromAddress: 'comercial@oportoforte.test',
      }),
    })
    if (r6.status !== 200) { fail(`PUT branding HTTP ${r6.status}`); allOk = false }
    else {
      const t = await prisma.tenant.findUnique({ where: { id: tenant.id } })
      if (t?.platformName === 'Academia Oporto Forte' && t?.emailFromName === 'Oporto Forte') {
        pass('Branding aplicado no tenant')
      } else { fail(`Branding não persistido: ${JSON.stringify(t)}`); allOk = false }
    }

    info('TASK-047b — Página /admin/settings/branding renderiza preview')
    const r7 = await adminPage.goto(`${BASE_URL}/admin/settings/branding`, { waitUntil: 'networkidle2' })
    if (r7?.status() !== 200) { fail(`HTTP ${r7?.status()}`); allOk = false }
    else {
      const previewExists = await adminPage.$('[data-testid="branding-preview"]')
      if (!previewExists) { fail('Preview ao vivo ausente'); allOk = false }
      else pass('Preview ao vivo presente')
    }

    // ─────────────────────────────────────────── TASK-048 CLIENT_HR
    info('TASK-048 — Login CLIENT_HR e validar isolamento por clientOrgId')
    await adminPage.close()

    const hrCtx = await browser.createBrowserContext()
    const hrPage = await hrCtx.newPage()
    await loginAs(hrPage, HR_EMAIL, HR_PASS)
    const r8 = await hrPage.goto(`${BASE_URL}/client/dashboard`, { waitUntil: 'networkidle2' })
    if (r8?.status() !== 200) { fail(`/client/dashboard HTTP ${r8?.status()}`); return false }
    const hrDashTxt = await hrPage.$eval('body', el => el.innerText)
    if (!hrDashTxt.includes('Decathlon')) { fail('Dashboard CLIENT_HR não mostra "Decathlon"'); allOk = false }
    else pass('Dashboard CLIENT_HR mostra clientOrg correta')

    info('TASK-048b — /client/trainees lista APENAS formandos Decathlon')
    const r9 = await hrPage.goto(`${BASE_URL}/client/trainees`, { waitUntil: 'networkidle2' })
    if (r9?.status() !== 200) { fail(`HTTP ${r9?.status()}`); return false }
    const traineesTxt = await hrPage.$eval('body', el => el.innerText)
    if (!traineesTxt.includes('Maryluz')) { fail('Maryluz (Decathlon) ausente'); allOk = false }
    else pass('Maryluz (Decathlon) listada')
    if (traineesTxt.includes('Pedro Outro')) { fail('Pedro (Outra Empresa) APAREÇU — isolamento quebrado'); allOk = false }
    else pass('Pedro (Outra Empresa) excluído — isolamento OK')

    info('TASK-048c — /admin/* como CLIENT_HR → 403')
    const r10 = await hrPage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle2' })
    if (r10?.status() !== 403) { fail(`HTTP ${r10?.status()} (esperava 403)`); allOk = false }
    else pass('CLIENT_HR em /admin/* → 403 (middleware)')

    await hrCtx.close()

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  } finally {
    if (browser) await browser.close()
  }
}

if (require.main === module) {
  runPhase18().then(ok => {
    console.log('\n' + (ok ? '✅ FASE 1.8 PASSOU' : '❌ ALGUMA TASK FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
