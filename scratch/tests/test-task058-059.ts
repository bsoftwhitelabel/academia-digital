import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser,
  header, pass, fail, info,
} from './harness'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'

const ADMIN_EMAIL = 'admin@oportoforte.com'

async function getCookieHeader(email: string, password: string) {
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(()=>{})
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

const ALL_DOC_TYPES = [
  'CAPA','EQUIPA_FORMATIVA','PROGRAMA_FORMACAO','PLANO_SESSAO',
  'FICHA_IDENTIFICACAO','CONTRATO_ENTIDADE','CONTRATO_FORMANDO','CONTRATO_FORMADOR',
  'REGISTO_SUMARIOS','REGISTO_PRESENCAS','AVALIACAO_APRENDIZAGEM','REGISTO_OCORRENCIAS',
  'JUSTIFICACAO_FALTA','RELATORIO_FINAL','COMPROVATIVO_ENTREGA','ATA_REUNIAO',
  'FICHA_ACAO','CONTRATO_PRESTACAO',
]

export async function runTask058059(): Promise<boolean> {
  header('TASK-058 + TASK-059 — 18 templates DGERT + DOSSIER_COMPLETO + ZIP')
  let allOk = true
  try {
    info('Setup base + obter actionId existente (Segurança e Higiene)')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    const sht = await prisma.course.findFirst({
      where: { tenantId: tenant.id, name: 'Segurança e Higiene no Trabalho' },
    })
    if (!sht) { fail('Curso SHT ausente — corre test-final.ts antes'); return false }
    const action = await prisma.trainingAction.findFirst({
      where: { courseId: sht.id, tenantId: tenant.id }, orderBy: { createdAt: 'desc' },
    })
    if (!action) { fail('Action SHT ausente'); return false }
    pass(`actionId=${action.id.slice(0,8)} (${action.actionCode})`)

    const cookieHeader = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')

    info('1. Cada um dos 18 docTypes individuais → PDF válido')
    const sizes: Record<string, number> = {}
    for (const dt of ALL_DOC_TYPES) {
      const r = await fetch(`${BASE_URL}/api/pdf/${action.id}/${dt}`, { headers: { cookie: cookieHeader } })
      if (r.status !== 200) {
        fail(`${dt}: HTTP ${r.status}`)
        allOk = false; continue
      }
      const buf = Buffer.from(await r.arrayBuffer())
      if (!buf.slice(0,4).toString('ascii').startsWith('%PDF')) {
        fail(`${dt}: não é PDF`)
        allOk = false; continue
      }
      sizes[dt] = buf.length
    }
    const sizeReport = Object.entries(sizes)
      .map(([k, v]) => `${k}=${(v/1024).toFixed(1)}KB`)
      .join(' · ')
    pass(`${Object.keys(sizes).length}/${ALL_DOC_TYPES.length} PDFs gerados`)
    info(sizeReport.slice(0, 280))

    info('2. DOSSIER_COMPLETO → PDF único merged')
    const r2 = await fetch(`${BASE_URL}/api/pdf/${action.id}/DOSSIER_COMPLETO`, { headers: { cookie: cookieHeader } })
    if (r2.status !== 200) { fail(`DOSSIER HTTP ${r2.status}: ${await r2.text()}`); return false }
    const dbuf = Buffer.from(await r2.arrayBuffer())
    if (!dbuf.slice(0,4).toString('ascii').startsWith('%PDF')) { fail('Não é PDF'); return false }
    // Usar pdf-lib para contar páginas (regex não funciona em object streams)
    const dossierDoc = await PDFDocument.load(dbuf)
    const pageCount = dossierDoc.getPageCount()
    pass(`DOSSIER PDF: ${(dbuf.length/1024).toFixed(1)} KB, ${pageCount} páginas`)
    if (pageCount < ALL_DOC_TYPES.length) { fail(`Esperava ≥${ALL_DOC_TYPES.length} páginas, obtive ${pageCount}`); allOk = false }
    // Content-Disposition deve referir DTP-...
    const cd = r2.headers.get('content-disposition') || ''
    if (!cd.includes('DTP-')) { fail(`Content-Disposition errada: ${cd}`); allOk = false }
    else pass(`Filename: ${cd.match(/filename="([^"]+)"/)?.[1]}`)

    info('3. ZIP com todos os documentos individuais')
    const r3 = await fetch(`${BASE_URL}/api/pdf/${action.id}/ZIP`, { headers: { cookie: cookieHeader } })
    if (r3.status !== 200) { fail(`ZIP HTTP ${r3.status}`); return false }
    const ct = r3.headers.get('content-type')
    if (!ct?.includes('application/zip')) { fail(`Content-Type=${ct}`); allOk = false }
    const zipBuf = Buffer.from(await r3.arrayBuffer())
    const zip = await JSZip.loadAsync(zipBuf)
    const files = Object.keys(zip.files).filter(f => !zip.files[f].dir)
    info(`  Files no ZIP (${files.length}):`)
    for (const f of files.slice(0, 6)) info(`    • ${f}`)
    if (files.length < 18) { fail(`Esperava ≥18 ficheiros (mais expansão por trainee), obtive ${files.length}`); allOk = false }
    else pass(`${files.length} ficheiros no ZIP (incluindo expansão per-trainee)`)
    // Verificar que todos terminam em .pdf
    const nonPdf = files.filter(f => !f.endsWith('.pdf'))
    if (nonPdf.length > 0) { fail(`Ficheiros não-PDF no ZIP: ${nonPdf.join(', ')}`); allOk = false }
    else pass('Todos os ficheiros do ZIP são .pdf')

    info('4. Verificar nomes correctos do ZIP (ex.: 10-folha-presencas.pdf)')
    const expected = ['00-capa.pdf','01-equipa-formativa.pdf','10-folha-presencas.pdf','21-ficha-acao.pdf']
    for (const e of expected) {
      if (!files.includes(e)) { fail(`  ✗ "${e}" ausente`); allOk = false }
      else pass(`  ✓ "${e}"`)
    }

    info('5. Per-trainee: ficheiros expandem por formando (Maryluz Lopes)')
    const traineeFiles = files.filter(f => f.includes('maryluz'))
    if (traineeFiles.length === 0) { fail('Sem ficheiros expandidos por Maryluz'); allOk = false }
    else pass(`Maryluz: ${traineeFiles.length} ficheiros (${traineeFiles.slice(0, 4).join(', ')}…)`)

    info('6. Bloqueio: TRAINEE → 403')
    const traineeCookies = await getCookieHeader('maryluz@decathlon.com', 'Trainee123!')
    const r4 = await fetch(`${BASE_URL}/api/pdf/${action.id}/DOSSIER_COMPLETO`, { headers: { cookie: traineeCookies } })
    if (r4.status !== 403) { fail(`Esperava 403, recebeu ${r4.status}`); allOk = false }
    else pass('TRAINEE → 403')

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTask058059().then(ok => {
    console.log('\n' + (ok ? '✅ TASKs 058+059 PASSARAM' : '❌ ALGUMA FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
