import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser,
  header, pass, fail, info,
} from './harness'

const ADMIN_EMAIL = 'admin@oportoforte.com'

export async function runTask060(): Promise<boolean> {
  header('TASK-060 — Botões Exportar Dossier Completo + ZIP no admin')
  let browser
  try {
    info('Setup')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    const sht = await prisma.course.findFirst({ where: { tenantId: tenant.id, name: 'Segurança e Higiene no Trabalho' } })
    const action = await prisma.trainingAction.findFirst({ where: { courseId: sht!.id }, orderBy: { createdAt: 'desc' } })
    if (!action) { fail('action ausente'); return false }
    pass(`actionId=${action.id.slice(0,8)}`)

    info('1. /admin/actions/[id] → Tab Documentos contém ambos os botões')
    await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(() => {})
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, ADMIN_EMAIL, 'Admin123!')
    const r = await page.goto(`${BASE_URL}/admin/actions/${action.id}`, { waitUntil: 'networkidle2' })
    if (r?.status() !== 200) { fail(`HTTP ${r?.status()}`); return false }

    // Mudar para Tab Documentos
    const triggers = await page.$$('[data-slot="tabs-trigger"]')
    for (const t of triggers) {
      const txt = await page.evaluate(el => el.textContent || '', t)
      if (txt.startsWith('Documentos')) { await t.click(); break }
    }
    await new Promise(r => setTimeout(r, 400))

    info('2. Verificar botões data-testid="export-dossier-pdf" e "export-dossier-zip"')
    const pdfBtn = await page.$('[data-testid="export-dossier-pdf"]')
    const zipBtn = await page.$('[data-testid="export-dossier-zip"]')
    if (!pdfBtn) { fail('Botão export-dossier-pdf ausente'); return false }
    if (!zipBtn) { fail('Botão export-dossier-zip ausente'); return false }
    pass('Ambos os botões presentes na Tab Documentos')

    info('3. Clicar PDF → captura download via response listener')
    const downloads: any[] = []
    page.on('response', (r) => {
      if (r.url().includes('/DOSSIER_COMPLETO') || r.url().includes('/ZIP')) {
        downloads.push({ url: r.url(), status: r.status(), ct: r.headers()['content-type'] })
      }
    })
    await pdfBtn.click()
    // Aguardar resposta
    let waited = 0
    while (waited < 120000 && !downloads.some(d => d.url.includes('DOSSIER_COMPLETO') && d.status === 200)) {
      await new Promise(r => setTimeout(r, 500)); waited += 500
    }
    const dossierResp = downloads.find(d => d.url.includes('DOSSIER_COMPLETO'))
    if (!dossierResp) { fail(`PDF response não capturado em ${waited}ms`); return false }
    if (dossierResp.status !== 200) { fail(`Dossier HTTP ${dossierResp.status}`); return false }
    if (!dossierResp.ct?.includes('application/pdf')) { fail(`CT errado: ${dossierResp.ct}`); return false }
    pass(`PDF dispatched (HTTP 200, CT=${dossierResp.ct})`)

    info('4. Clicar ZIP → captura download')
    await zipBtn.click()
    waited = 0
    while (waited < 120000 && !downloads.some(d => d.url.includes('/ZIP') && d.status === 200)) {
      await new Promise(r => setTimeout(r, 500)); waited += 500
    }
    const zipResp = downloads.find(d => d.url.endsWith('/ZIP'))
    if (!zipResp) { fail('ZIP response não capturado'); return false }
    if (zipResp.status !== 200) { fail(`ZIP HTTP ${zipResp.status}`); return false }
    if (!zipResp.ct?.includes('application/zip')) { fail(`CT errado: ${zipResp.ct}`); return false }
    pass(`ZIP dispatched (HTTP 200, CT=${zipResp.ct})`)

    info('5. Texto descritivo "18 documentos oficiais" presente')
    const txt = await page.$eval('body', el => el.innerText)
    if (!txt.includes('Dossier Técnico-Pedagógico')) { fail('Título DTP ausente'); return false }
    if (!txt.includes('DGERT')) { fail('Menção DGERT ausente'); return false }
    pass('Texto descritivo presente')

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
  runTask060().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-060 PASSOU' : '❌ TASK-060 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
