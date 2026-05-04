import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser,
  header, pass, fail, info,
} from './harness'

const ADMIN_EMAIL = 'admin@oportoforte.com'

async function getCookieHeader(email: string, password: string) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

export async function runTask049(): Promise<boolean> {
  header('TASK-049 — Auditoria automática')
  let allOk = true
  try {
    info('Setup')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const adminUser = await ensureAdminUser({
      email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id,
    })
    pass(`Setup OK — userId=${adminUser.id.slice(0,8)}`)

    info('1. Login → AuditLog LOGIN')
    const beforeLogin = await prisma.auditLog.count({
      where: { action: 'LOGIN', userId: adminUser.id },
    })
    const cookieHeader = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    // Esperar pelo log async
    let waited = 0
    let afterLogin = beforeLogin
    while (waited < 6000 && afterLogin === beforeLogin) {
      await new Promise(r => setTimeout(r, 300)); waited += 300
      afterLogin = await prisma.auditLog.count({ where: { action: 'LOGIN', userId: adminUser.id } })
    }
    if (afterLogin <= beforeLogin) { fail(`AuditLog LOGIN não criado (${beforeLogin} → ${afterLogin})`); allOk = false }
    else pass(`AuditLog LOGIN criado (${beforeLogin} → ${afterLogin})`)

    info('2. CREATE Course → AuditLog CREATE')
    const r1 = await fetch(`${BASE_URL}/api/admin/courses`, {
      method: 'POST', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Curso Audit Test ' + Date.now(),
        durationHours: 8, format: 'PRESENCIAL', status: 'DRAFT',
      }),
    })
    if (r1.status !== 200) { fail(`POST course HTTP ${r1.status}`); return false }
    const created = await r1.json()
    const createLog = await prisma.auditLog.findFirst({
      where: { action: 'CREATE', resource: 'Course', resourceId: created.courseId },
    })
    if (!createLog) { fail('AuditLog CREATE Course ausente'); allOk = false }
    else if (createLog.userId !== adminUser.id) { fail(`userId errado: ${createLog.userId}`); allOk = false }
    else if (!createLog.ipAddress) { fail('ipAddress vazio'); allOk = false }
    else if (!createLog.userAgent) { fail('userAgent vazio'); allOk = false }
    else if (!(createLog.changes as any)?.after?.name) { fail('changes.after.name ausente'); allOk = false }
    else pass(`AuditLog CREATE Course OK — ip=${createLog.ipAddress} ua=${createLog.userAgent.slice(0,30)}…`)

    info('3. UPDATE Course → AuditLog UPDATE com diff')
    const r2 = await fetch(`${BASE_URL}/api/admin/courses/${created.courseId}`, {
      method: 'PUT', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Curso RENOMEADO', status: 'PUBLISHED' }),
    })
    if (r2.status !== 200) { fail(`PUT HTTP ${r2.status}`); return false }
    const updateLog = await prisma.auditLog.findFirst({
      where: { action: 'UPDATE', resource: 'Course', resourceId: created.courseId },
      orderBy: { createdAt: 'desc' },
    })
    if (!updateLog) { fail('AuditLog UPDATE Course ausente'); allOk = false }
    else {
      const ch = updateLog.changes as any
      if (!ch?.before?.name || !ch?.after?.name) { fail(`diff incompleto: ${JSON.stringify(ch)}`); allOk = false }
      else if (ch.after.name !== 'Curso RENOMEADO') { fail(`after.name=${ch.after.name}`); allOk = false }
      else pass(`AuditLog UPDATE Course OK — diff name "${ch.before.name}" → "${ch.after.name}"`)
    }

    info('4. UPDATE Tenant (branding) → AuditLog UPDATE')
    const r3 = await fetch(`${BASE_URL}/api/admin/tenant/branding`, {
      method: 'PUT', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ platformName: 'Audit Test ' + Date.now() }),
    })
    if (r3.status !== 200) { fail(`PUT branding HTTP ${r3.status}`); return false }
    const tenantLog = await prisma.auditLog.findFirst({
      where: { action: 'UPDATE', resource: 'Tenant', resourceId: tenant.id },
      orderBy: { createdAt: 'desc' },
    })
    if (!tenantLog) { fail('AuditLog UPDATE Tenant ausente'); allOk = false }
    else pass(`AuditLog UPDATE Tenant OK`)

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTask049().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-049 PASSOU' : '❌ TASK-049 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
