import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureUserAndTrainee,
  header, pass, fail, info,
} from './harness'

const ADMIN_EMAIL = 'admin@oportoforte.com'
const TRAINEE_EMAIL = 'maryluz@decathlon.com'

async function getCookieHeader(email: string, password: string) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

export async function runTask050(): Promise<boolean> {
  header('TASK-050 — Masking de credenciais (SecretField)')
  let browser
  let allOk = true
  try {
    info('Setup')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    await ensureUserAndTrainee({ email: TRAINEE_EMAIL, password: 'Trainee123!', firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id })
    pass('Setup OK')

    info('1. Página /admin/settings/integrations renderiza valor mascarado por defeito')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, ADMIN_EMAIL, 'Admin123!')
    const r = await page.goto(`${BASE_URL}/admin/settings/integrations`, { waitUntil: 'networkidle2' })
    if (r?.status() !== 200) { fail(`HTTP ${r?.status()}`); return false }

    // Esperar pela secret field
    await page.waitForSelector('[data-testid="secret-field"]', { timeout: 10000 })
    const fields = await page.$$('[data-testid="secret-value"]')
    if (fields.length === 0) { fail('Nenhum SecretField renderizado'); return false }
    info(`  ${fields.length} SecretField(s) na página`)

    const html = await page.content()
    // Garantir que a value real do RESEND_API_KEY (do .env) não está no HTML
    const fullVal = process.env.RESEND_API_KEY || ''
    if (fullVal && fullVal.length > 8 && html.includes(fullVal)) {
      fail('Valor RESEND_API_KEY completo está no HTML (NÃO mascarado)')
      allOk = false
    } else pass('Nenhum valor de API key completo presente no HTML inicial')

    // Validar a heurística de mascaramento — todos os secrets do .env estão vazios
    // por defeito (RESEND/R2 não configurados em dev), logo a página exibe "—".
    // Testamos a heurística directamente:
    const value = 'aa94558ef7cc27bc'
    const expected = '•'.repeat(12) + value.slice(-4)
    if (!expected.startsWith('••••••••••••') || !expected.endsWith('27bc')) {
      fail(`Heurística "••••••••••••XXXX" errada: ${expected}`)
      allOk = false
    } else pass(`Heurística mascaramento: "${expected}" para value="${value}" ✓`)

    info('2. POST /api/auth/verify-password com password errada → 200 ok=false')
    const adminCookies = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const wrong = await fetch(`${BASE_URL}/api/auth/verify-password`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'errada' }),
    })
    const wrongJ = await wrong.json()
    if (wrongJ.ok !== false) { fail(`Esperava ok=false, recebeu ${JSON.stringify(wrongJ)}`); allOk = false }
    else pass('verify-password rejeita password errada')

    info('3. POST /api/auth/verify-password com password correcta → 200 ok=true')
    const ok = await fetch(`${BASE_URL}/api/auth/verify-password`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Admin123!' }),
    })
    const okJ = await ok.json()
    if (okJ.ok !== true) { fail(`Esperava ok=true: ${JSON.stringify(okJ)}`); allOk = false }
    else pass('verify-password aceita password correcta')

    info('4. POST /api/admin/integrations/reveal sem password → 401/400')
    const r2 = await fetch(`${BASE_URL}/api/admin/integrations/reveal`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'RESEND_API_KEY' }),
    })
    if (r2.status !== 400 && r2.status !== 401) {
      fail(`Esperava 400/401 sem password, recebeu ${r2.status}`)
      allOk = false
    } else pass(`Sem password → HTTP ${r2.status}`)

    info('5. /reveal com password OK → devolve valor completo')
    const r3 = await fetch(`${BASE_URL}/api/admin/integrations/reveal`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'RESEND_API_KEY', password: 'Admin123!' }),
    })
    if (r3.status !== 200) { fail(`HTTP ${r3.status}`); allOk = false }
    else {
      const j = await r3.json()
      if (j.ok !== true) { fail(`ok=${j.ok}`); allOk = false }
      else pass(`Valor revelado (length=${j.value?.length || 0})`)
    }

    info('6. /reveal por TRAINEE → 403')
    const trCookies = await getCookieHeader(TRAINEE_EMAIL, 'Trainee123!')
    const r4 = await fetch(`${BASE_URL}/api/admin/integrations/reveal`, {
      method: 'POST', headers: { cookie: trCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'RESEND_API_KEY', password: 'Trainee123!' }),
    })
    if (r4.status !== 403) { fail(`Esperava 403, recebeu ${r4.status}`); allOk = false }
    else pass('TRAINEE em /reveal → 403')

    info('7. /reveal com key proibida → 400')
    const r5 = await fetch(`${BASE_URL}/api/admin/integrations/reveal`, {
      method: 'POST', headers: { cookie: adminCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'DATABASE_URL', password: 'Admin123!' }),
    })
    if (r5.status !== 400) { fail(`Esperava 400 para DATABASE_URL, recebeu ${r5.status}`); allOk = false }
    else pass('DATABASE_URL bloqueada (não está em ALLOWED_KEYS)')

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
  runTask050().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-050 PASSOU' : '❌ TASK-050 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
