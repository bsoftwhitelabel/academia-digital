import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureUserAndTrainee,
  header, pass, fail, info,
} from './harness'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = 'admin@oportoforte.com'

export async function runTask049b(): Promise<boolean> {
  header('TASK-049b — Página /admin/settings/audit')
  let browser
  let allOk = true
  try {
    info('Setup: tenant + admin (TENANT_ADMIN) + STAFF (TENANT_STAFF) + trainee')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    await ensureUserAndTrainee({ email: 'maryluz@decathlon.com', password: 'Trainee123!', firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id })

    // Criar STAFF user
    const staffHash = await bcrypt.hash('Staff123!', 10)
    await prisma.user.upsert({
      where: { email: 'staff@oportoforte.com' },
      update: { passwordHash: staffHash, role: 'TENANT_STAFF', tenantId: tenant.id },
      create: { email: 'staff@oportoforte.com', passwordHash: staffHash, role: 'TENANT_STAFF',
                firstName: 'Staff', lastName: 'Test', tenantId: tenant.id },
    })

    // Criar pelo menos um audit log para garantir conteúdo
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id, userId: null,
        action: 'CREATE', resource: 'TestSeed',
        resourceId: 'fake-' + Date.now(),
        ipAddress: '127.0.0.1', userAgent: 'test-runner',
        changes: { after: { foo: 'bar' } } as any,
      },
    })
    pass('Setup OK')

    info('1. ADMIN (TENANT_ADMIN) → /admin/settings/audit HTTP 200')
    browser = await launchBrowser()
    const adminPage = await browser.newPage()
    await loginAs(adminPage, ADMIN_EMAIL, 'Admin123!')
    const r = await adminPage.goto(`${BASE_URL}/admin/settings/audit`, { waitUntil: 'networkidle2' })
    if (r?.status() !== 200) { fail(`HTTP ${r?.status()}`); return false }
    await adminPage.waitForSelector('[data-testid="audit-table"]', { timeout: 10000 })
    pass('Tabela de auditoria renderizada')

    info('2. Verificar colunas: Data/hora, Utilizador, Ação, Recurso, IP, Detalhe')
    const txt = (await adminPage.$eval('body', el => el.innerText)).toLowerCase()
    for (const lbl of ['data/hora','utilizador','ação','recurso','ip','detalhe']) {
      if (!txt.includes(lbl)) { fail(`Coluna "${lbl}" ausente`); allOk = false }
    }
    if (allOk) pass('Todas as 6 colunas presentes (case-insensitive)')

    info('3. Sub-nav com 3 tabs: Branding | Integrações | Auditoria')
    for (const tab of ['branding','integrações','auditoria']) {
      if (!txt.includes(tab)) { fail(`Tab "${tab}" ausente`); allOk = false }
    }
    if (allOk) pass('Sub-nav com Branding/Integrações/Auditoria')

    info('4. Filtros (form com user/action/from/to)')
    const filters = await adminPage.$$('form select, form input[type="date"]')
    if (filters.length < 3) { fail(`Esperava ≥3 filtros, encontrei ${filters.length}`); allOk = false }
    else pass(`${filters.length} filtros`)

    info('5. STAFF (TENANT_STAFF) → 403 (não pode ver auditoria)')
    const staffCtx = await browser.createBrowserContext()
    const staffPage = await staffCtx.newPage()
    await loginAs(staffPage, 'staff@oportoforte.com', 'Staff123!')
    const r2 = await staffPage.goto(`${BASE_URL}/admin/settings/audit`, { waitUntil: 'networkidle2' })
    // STAFF passa pelo middleware (admin role allowed) mas a página redirect para /dashboard
    const finalUrl = staffPage.url()
    if (!finalUrl.includes('/admin/dashboard')) {
      fail(`STAFF não foi redirecionado: ${finalUrl}`)
      allOk = false
    } else pass(`STAFF redirected para /admin/dashboard (${r2?.status()}) — apenas TENANT_ADMIN vê auditoria`)
    await staffCtx.close()

    info('6. TRAINEE → 403 pelo middleware')
    const trCtx = await browser.createBrowserContext()
    const trPage = await trCtx.newPage()
    await loginAs(trPage, 'maryluz@decathlon.com', 'Trainee123!')
    const r3 = await trPage.goto(`${BASE_URL}/admin/settings/audit`, { waitUntil: 'networkidle2' })
    if (r3?.status() !== 403) { fail(`HTTP ${r3?.status()}`); allOk = false }
    else pass('TRAINEE em /admin/settings/audit → 403 (middleware)')
    await trCtx.close()

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
  runTask049b().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-049b PASSOU' : '❌ TASK-049b FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
