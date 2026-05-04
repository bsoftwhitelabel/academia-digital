import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureUserAndTrainee,
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

async function teste001(): Promise<boolean> {
  header('TESTE-SEGURANÇA-001 — Rate limiting (6 tentativas → 429)')
  const ip = '198.51.100.42'  // IP isolado para o teste
  let allOk = true

  info('1. 5 tentativas com password errada → não 429')
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip },
      body: `email=${ADMIN_EMAIL}&password=errada`,
      redirect: 'manual',
    })
    if (r.status === 429) { fail(`Tentativa ${i} já 429`); return false }
  }
  pass('5 tentativas passaram')

  info('2. 6ª tentativa → 429')
  const r6 = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip },
    body: `email=${ADMIN_EMAIL}&password=errada`,
    redirect: 'manual',
  })
  if (r6.status !== 429) { fail(`HTTP ${r6.status}`); return false }
  const body = await r6.text()
  if (!body.includes('Demasiadas tentativas')) { fail(`Mensagem: ${body}`); allOk = false }
  else pass(`6ª → 429 + "${body.slice(0, 60)}…"`)

  info('3. Aguardar 1s → ainda 429')
  await new Promise(r => setTimeout(r, 1000))
  const r7 = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip },
    body: `email=${ADMIN_EMAIL}&password=errada`,
    redirect: 'manual',
  })
  if (r7.status !== 429) { fail(`Após 1s: HTTP ${r7.status}`); allOk = false }
  else pass('Continua bloqueado')
  return allOk
}

async function teste002(): Promise<boolean> {
  header('TESTE-SEGURANÇA-002 — Headers de segurança')
  const r = await fetch(`${BASE_URL}/admin/dashboard`, { redirect: 'manual' })
  const expected = [
    ['x-frame-options', 'DENY'],
    ['x-content-type-options', 'nosniff'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['permissions-policy', 'camera=()'],
    ['x-xss-protection', '1; mode=block'],
    ['content-security-policy', 'default-src'],
  ]
  let allOk = true
  for (const [name, mustContain] of expected) {
    const v = r.headers.get(name)
    if (!v) { fail(`Header "${name}" ausente`); allOk = false }
    else if (!v.toLowerCase().includes(String(mustContain).toLowerCase())) {
      fail(`Header "${name}" não contém "${mustContain}": "${v}"`)
      allOk = false
    } else pass(`${name}: ${v.slice(0, 60)}`)
  }
  return allOk
}

async function teste003(): Promise<boolean> {
  header('TESTE-SEGURANÇA-003 — Masking de credenciais')
  // Reset rate-limit (dev-only) para garantir que loginAs não fica bloqueado
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' })
  let browser
  let allOk = true
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, ADMIN_EMAIL, 'Admin123!')
    const r = await page.goto(`${BASE_URL}/admin/settings/integrations`, { waitUntil: 'networkidle2' })
    if (r?.status() !== 200) { fail(`HTTP ${r?.status()}`); return false }

    info('1. Página renderiza secrets mascarados por defeito (sem ENV exposto)')
    const html = await page.content()
    const fullEnv = process.env.RESEND_API_KEY || ''
    if (fullEnv && fullEnv.length > 8 && html.includes(fullEnv)) {
      fail('Valor RESEND_API_KEY completo no HTML inicial')
      allOk = false
    } else pass('Nenhum valor de API key completo no HTML inicial')

    info('2. POST /reveal com password errada → 401')
    const adminCookies = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const wrong = await fetch(`${BASE_URL}/api/admin/integrations/reveal`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'RESEND_API_KEY', password: 'errada' }),
    })
    if (wrong.status !== 401) { fail(`Esperava 401, recebeu ${wrong.status}`); allOk = false }
    else pass('Password errada → 401')

    info('3. POST /reveal com password OK → revela')
    const ok = await fetch(`${BASE_URL}/api/admin/integrations/reveal`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'RESEND_API_KEY', password: 'Admin123!' }),
    })
    const okJ = await ok.json()
    if (okJ.ok !== true) { fail(`ok=${okJ.ok}`); allOk = false }
    else pass(`Revelado (length=${okJ.value?.length || 0})`)

    info('4. Reveal protegido por session — sem cookie → 401')
    const noAuth = await fetch(`${BASE_URL}/api/admin/integrations/reveal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'RESEND_API_KEY', password: 'Admin123!' }),
    })
    if (noAuth.status !== 401) { fail(`Sem session: HTTP ${noAuth.status}`); allOk = false }
    else pass('Sem session → 401')

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    return false
  } finally {
    if (browser) await browser.close()
  }
}

async function teste004(): Promise<boolean> {
  header('TESTE-SEGURANÇA-004 — Logs de auditoria')
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' })
  let allOk = true
  try {
    info('1. Setup + criar curso novo')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const adminUser = await ensureAdminUser({
      email: ADMIN_EMAIL, password: 'Admin123!',
      firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id,
    })
    const cookieHeader = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const r1 = await fetch(`${BASE_URL}/api/admin/courses`, {
      method: 'POST', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Curso Audit ' + Date.now(), durationHours: 4, format: 'PRESENCIAL', status: 'DRAFT' }),
    })
    if (r1.status !== 200) { fail(`POST course HTTP ${r1.status}`); return false }
    const created = await r1.json()
    pass(`Curso criado: ${created.courseId.slice(0,8)}`)

    info('2. AuditLog CREATE Course com userId, tenantId, IP, timestamp')
    const createLog = await prisma.auditLog.findFirst({
      where: { action: 'CREATE', resource: 'Course', resourceId: created.courseId },
    })
    if (!createLog) { fail('AuditLog CREATE ausente'); return false }
    const checks: [string, boolean][] = [
      ['userId', !!createLog.userId],
      ['tenantId', createLog.tenantId === tenant.id],
      ['ipAddress', !!createLog.ipAddress],
      ['userAgent', !!createLog.userAgent],
      ['createdAt', !!createLog.createdAt],
    ]
    for (const [k, ok] of checks) {
      if (!ok) { fail(`  ✗ ${k} ausente/incorrecto`); allOk = false }
      else pass(`  ✓ ${k}: ${(createLog as any)[k]?.toString?.().slice(0, 30) ?? '(set)'}`)
    }

    info('3. PUT Course → AuditLog UPDATE com before/after')
    const r2 = await fetch(`${BASE_URL}/api/admin/courses/${created.courseId}`, {
      method: 'PUT', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Curso RENOMEADO ' + Date.now(), status: 'PUBLISHED' }),
    })
    if (r2.status !== 200) { fail(`PUT HTTP ${r2.status}`); return false }
    const updateLog = await prisma.auditLog.findFirst({
      where: { action: 'UPDATE', resource: 'Course', resourceId: created.courseId },
      orderBy: { createdAt: 'desc' },
    })
    if (!updateLog) { fail('AuditLog UPDATE ausente'); return false }
    const ch = updateLog.changes as any
    if (!ch?.before || !ch?.after) { fail(`changes incompleto: ${JSON.stringify(ch)}`); allOk = false }
    else if (ch.before.name === ch.after.name) { fail('before.name == after.name'); allOk = false }
    else pass(`UPDATE diff: name "${ch.before.name}" → "${ch.after.name}"`)

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    return false
  }
}

async function main() {
  const results = {
    t001: await teste001(),
    t002: await teste002(),
    t003: await teste003(),
    t004: await teste004(),
  }
  console.log('\n══════════════════════════════════════════════')
  console.log('  RESUMO TESTES SEGURANÇA')
  console.log('══════════════════════════════════════════════')
  console.log(`  001 Rate limiting:        ${results.t001 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  002 Headers segurança:    ${results.t002 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  003 Masking credenciais:  ${results.t003 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  004 Logs auditoria:       ${results.t004 ? '✅ PASS' : '❌ FAIL'}`)
  const ok = Object.values(results).every(Boolean)
  console.log('\n' + (ok ? '✅ TODOS OS TESTES SEGURANÇA PASSARAM' : '❌ ALGUMA FALHOU'))
  await prisma.$disconnect()
  process.exit(ok ? 0 : 1)
}

if (require.main === module) main()
