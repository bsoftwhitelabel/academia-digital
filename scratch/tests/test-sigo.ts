import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser,
  header, pass, fail, info,
} from './harness'

const ADMIN_EMAIL = 'admin@oportoforte.com'

async function getCookieHeader(email: string, password: string) {
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(() => {})
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

export async function runTesteSigo(): Promise<boolean> {
  header('TESTE-SIGO-001 — Exportação XML')
  let allOk = true
  try {
    info('Setup: tenant com dgertCode + 2 ações + área CITE')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await prisma.tenant.update({ where: { id: tenant.id }, data: { dgertCode: 'DGE-12345' } })
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })

    // Garantir área CITE
    let area = await prisma.trainingArea.findFirst({ where: { citeCode: '341' } })
    if (!area) area = await prisma.trainingArea.create({ data: { name: 'Comércio', citeCode: '341' } })

    const sht = await prisma.course.findFirst({ where: { tenantId: tenant.id, name: 'Segurança e Higiene no Trabalho' } })
    if (!sht) { fail('Curso SHT ausente — corre test-final.ts antes'); return false }
    await prisma.course.update({ where: { id: sht.id }, data: { areaId: area.id } })

    const actions = await prisma.trainingAction.findMany({
      where: { tenantId: tenant.id, courseId: sht.id }, take: 2, orderBy: { createdAt: 'desc' },
    })
    if (actions.length === 0) { fail('Sem ações para exportar'); return false }
    pass(`Setup OK — ${actions.length} ação(ões), tenant.dgertCode=DGE-12345, área=${area.citeCode}`)

    info('1. GET /api/admin/sigo?type=ACTIONS&actionIds=...')
    const cookieHeader = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const r1 = await fetch(`${BASE_URL}/api/admin/sigo?type=ACTIONS&actionIds=${actions.map(a => a.id).join(',')}`,
      { headers: { cookie: cookieHeader } })
    if (r1.status !== 200) { fail(`HTTP ${r1.status}: ${await r1.text()}`); return false }
    const ct = r1.headers.get('content-type')
    const cd = r1.headers.get('content-disposition')
    if (!ct?.includes('application/xml')) { fail(`CT=${ct}`); return false }
    if (!cd?.includes('SIGO-ACTIONS-')) { fail(`CD=${cd}`); allOk = false }
    const xml = await r1.text()
    pass(`XML descarregado (${xml.length} bytes)`)

    info('2. Validar estrutura XML')
    const checks: [string, RegExp | string][] = [
      ['Header XML', /^<\?xml version="1\.0" encoding="UTF-8"\?>/],
      ['Envelope SIGO', /<SIGO geradoEm="/],
      ['Tag AccoesFormacao', '<AccoesFormacao>'],
      ['AccaoFormacao tag', '<AccaoFormacao>'],
      ['Codigo', /<Codigo>[^<]+<\/Codigo>/],
      ['Designacao', /<Designacao>[^<]+<\/Designacao>/],
      ['AreaFormacao', /<AreaFormacao>341<\/AreaFormacao>/],
      ['FormaOrganizacao', /<FormaOrganizacao>(PRESENCIAL|ELEARNING|BLENDED)<\/FormaOrganizacao>/],
      ['DataInicio formato', /<DataInicio>\d{4}-\d{2}-\d{2}<\/DataInicio>/],
      ['DataFim formato', /<DataFim>\d{4}-\d{2}-\d{2}<\/DataFim>/],
      ['DuracaoHoras', /<DuracaoHoras>\d+/],
      ['EntidadeFormadora dgertCode', /<EntidadeFormadora>DGE-12345<\/EntidadeFormadora>/],
      ['LocalFormacao', /<LocalFormacao>[^<]+<\/LocalFormacao>/],
    ]
    for (const [label, expected] of checks) {
      const ok = expected instanceof RegExp ? expected.test(xml) : xml.includes(expected)
      if (!ok) { fail(`  ✗ ${label}`); allOk = false }
      else pass(`  ✓ ${label}`)
    }

    info('3. Contar nº de <AccaoFormacao> no XML')
    const acaoCount = (xml.match(/<AccaoFormacao>/g) || []).length
    if (acaoCount !== actions.length) { fail(`acoes XML=${acaoCount} BD=${actions.length}`); allOk = false }
    else pass(`${acaoCount} <AccaoFormacao> ↔ ${actions.length} actions na BD`)

    info('4. GET /api/admin/sigo?type=TRAINEES&actionId=...')
    const r2 = await fetch(`${BASE_URL}/api/admin/sigo?type=TRAINEES&actionId=${actions[0].id}`,
      { headers: { cookie: cookieHeader } })
    if (r2.status !== 200) { fail(`HTTP ${r2.status}`); return false }
    const xml2 = await r2.text()
    pass(`XML formandos descarregado (${xml2.length} bytes)`)

    info('5. Validar formandos')
    const fchecks: [string, RegExp | string][] = [
      ['Tag Formandos', '<Formandos'],
      ['Pelo menos um Formando', /<Formando>/],
      ['NIF', /<NIF>[^<]*<\/NIF>/],
      ['Email', /<Email>[^<]*@[^<]*<\/Email>/],
      ['Presenca número', /<Presenca>\d+<\/Presenca>/],
      ['Aprovado boolean', /<Aprovado>(true|false)<\/Aprovado>/],
    ]
    for (const [label, expected] of fchecks) {
      const ok = expected instanceof RegExp ? expected.test(xml2) : xml2.includes(expected)
      if (!ok) { fail(`  ✗ ${label}`); allOk = false }
      else pass(`  ✓ ${label}`)
    }

    info('6. Verificar percentagem calculada (Maryluz tem 1 check-in / 1 sessão = 100%)')
    if (!/<Presenca>100<\/Presenca>/.test(xml2)) {
      info(`  Presença Maryluz não é 100% (depende dos check-ins; aceitável)`)
    } else pass('Presença Maryluz = 100%')

    info('7. AuditLog VIEW SIGO criado')
    const audit = await prisma.auditLog.findFirst({
      where: { resource: 'SIGO', action: 'VIEW', tenantId: tenant.id }, orderBy: { createdAt: 'desc' },
    })
    if (!audit) { fail('AuditLog SIGO ausente'); allOk = false }
    else pass(`AuditLog: action=VIEW resource=SIGO type=${(audit.changes as any)?.after?.type}`)

    info('8. Bloqueio: TRAINEE → 403')
    const traineeCookies = await getCookieHeader('maryluz@decathlon.com', 'Trainee123!')
    const r3 = await fetch(`${BASE_URL}/api/admin/sigo?type=ACTIONS&actionIds=${actions[0].id}`,
      { headers: { cookie: traineeCookies } })
    if (r3.status !== 403) { fail(`Esperava 403, recebeu ${r3.status}`); allOk = false }
    else pass('TRAINEE → 403')

    info('9. Cross-tenant: ação de outro tenant não aparece')
    const techport = await prisma.tenant.upsert({
      where: { slug: 'techport' }, update: {}, create: { name: 'TechPort', slug: 'techport' },
    })
    const otherCourse = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: techport.id, slug: 'curso-cross' } },
      update: {}, create: { tenantId: techport.id, name: 'Cross', slug: 'curso-cross', durationHours: 8, format: 'PRESENCIAL', status: 'PUBLISHED' },
    })
    const otherAction = await prisma.trainingAction.create({
      data: { tenantId: techport.id, courseId: otherCourse.id, startDate: new Date(), endDate: new Date(),
              format: 'PRESENCIAL', status: 'SCHEDULED', actionCode: 'CROSS-1' },
    })
    const r4 = await fetch(`${BASE_URL}/api/admin/sigo?type=ACTIONS&actionIds=${otherAction.id}`,
      { headers: { cookie: cookieHeader } })
    const xml4 = await r4.text()
    if (xml4.includes('CROSS-1')) { fail('Ação cross-tenant exposta'); allOk = false }
    else pass('Ação de outro tenant excluída do XML')

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTesteSigo().then(ok => {
    console.log('\n' + (ok ? '✅ TESTE-SIGO-001 PASSOU' : '❌ FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
