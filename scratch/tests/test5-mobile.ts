import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureUserAndTrainee, ensureTrainer,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'
import { DocumentType, SignatureStatus } from '@prisma/client'

const VIEWPORT = { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

async function audit(page: any, label: string, expectedText: string[]): Promise<{ ok: boolean; details: string[] }> {
  const details: string[] = []
  let ok = true

  const metrics = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    innerW: window.innerWidth,
    bodyW: document.body.scrollWidth,
  }))
  details.push(`viewport=${metrics.innerW}px scrollWidth=${metrics.scrollW}px bodyScrollWidth=${metrics.bodyW}px`)
  // Allow 1-2px tolerance
  if (metrics.scrollW > metrics.innerW + 2) {
    ok = false
    details.push(`OVERFLOW horizontal: scrollWidth (${metrics.scrollW}) > innerWidth (${metrics.innerW})`)
  }

  // Find offending elements
  const overflowers: { tag: string; cls: string; right: number }[] = await page.evaluate((vw: number) => {
    const out: any[] = []
    const all = document.querySelectorAll('*')
    for (const el of Array.from(all)) {
      const r = (el as HTMLElement).getBoundingClientRect()
      if (r.right > vw + 2 && r.width > 0 && r.height > 0) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: ((el as HTMLElement).className?.toString?.() || '').slice(0, 80),
          right: Math.round(r.right),
        })
      }
    }
    return out.slice(0, 5)
  }, metrics.innerW)

  if (overflowers.length > 0) {
    details.push(`Elementos a exceder viewport: ${overflowers.length}`)
    for (const o of overflowers) details.push(`  • <${o.tag} class="${o.cls}"> right=${o.right}px`)
    // Only fail if scrollWidth itself overflows (above check). Individual element overflow with overflow:hidden is OK.
  }

  // Check key elements visible
  const text = await page.$eval('body', (el: any) => el.innerText)
  for (const expected of expectedText) {
    if (text.toLowerCase().includes(expected.toLowerCase())) {
      details.push(`✓ contém "${expected}"`)
    } else {
      ok = false
      details.push(`✗ FALTA "${expected}"`)
    }
  }

  return { ok, details }
}

export async function runTest5(): Promise<boolean> {
  header('TESTE-005 — Responsividade 375px (iPhone SE)')
  let browser
  try {
    info('1. Setup BD: tenant, Maryluz, sessão aberta, doc ENABLED')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const trainer = await ensureTrainer(tenant.id)
    const { trainee } = await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })
    const { actionId, sessionId } = await createOpenTrainingAction({
      tenantId: tenant.id, trainerId: trainer.id, courseSlug: 'teste-005-curso',
    })
    await enrollTrainee(actionId, trainee.id)
    // Close other open sessions for Maryluz so only mine shows
    await prisma.trainingSession.updateMany({
      where: { isOpen: true, id: { not: sessionId },
        trainingAction: { enrollments: { some: { traineeId: trainee.id } } } },
      data: { isOpen: false, isClosed: true, closedAt: new Date() },
    })
    await prisma.checkIn.deleteMany({ where: { sessionId, traineeId: trainee.id } })

    await prisma.documentSignature.deleteMany({
      where: { traineeId: trainee.id, documentType: DocumentType.AVALIACAO_FORMANDO },
    })
    const docSig = await prisma.documentSignature.create({
      data: {
        traineeId: trainee.id,
        documentType: DocumentType.AVALIACAO_FORMANDO,
        status: SignatureStatus.ENABLED,
        enabledAt: new Date(),
      },
    })
    pass(`Setup OK — sessionId=${sessionId.slice(0,8)} docId=${docSig.id.slice(0,8)}`)

    info('2. Browser 375px (iPhone SE)')
    browser = await launchBrowser({ width: 375, height: 667 } as any)
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)

    // ── /oportoforte/catalog (sem login)
    info('3. /oportoforte/catalog (sem login)')
    const ctx = await browser.createBrowserContext()
    const guest = await ctx.newPage()
    await guest.setViewport(VIEWPORT)
    const r1 = await guest.goto(`${BASE_URL}/oportoforte/catalog`, { waitUntil: 'networkidle2' })
    if (r1?.status() !== 200) { fail(`HTTP ${r1?.status()}`); return false }
    const a1 = await audit(guest, 'catalog', ['Catálogo de Formação', 'Liderança e Gestão de Equipas'])
    a1.details.forEach(d => info('  ' + d))
    if (!a1.ok) { fail('catalog falhou auditoria mobile'); return false }
    pass('/oportoforte/catalog responsivo OK')
    await ctx.close()

    // ── login + /trainee/dashboard
    info('4. /trainee/dashboard')
    await loginAs(page, 'maryluz@decathlon.com', 'Trainee123!')
    if (!page.url().includes('/trainee/dashboard')) {
      fail(`URL pós-login: ${page.url()}`)
      return false
    }
    const a2 = await audit(page, 'dashboard', ['Painel de Bordo', 'Cursos Concluídos', 'Fazer Check-in Agora'])
    a2.details.forEach(d => info('  ' + d))
    if (!a2.ok) { fail('dashboard falhou auditoria mobile'); return false }
    pass('/trainee/dashboard responsivo OK')

    // ── /trainee/checkin/[id]
    info(`5. /trainee/checkin/${sessionId.slice(0,8)}…`)
    await page.goto(`${BASE_URL}/trainee/checkin/${sessionId}`, { waitUntil: 'networkidle2' })
    const a3 = await audit(page, 'checkin', ['Registo de Presença', 'Confirmar Presença'])
    a3.details.forEach(d => info('  ' + d))
    if (!a3.ok) { fail('checkin falhou auditoria mobile'); return false }
    pass('/trainee/checkin responsivo OK')

    // ── /trainee/sign/[id]
    info(`6. /trainee/sign/${docSig.id.slice(0,8)}…`)
    await page.goto(`${BASE_URL}/trainee/sign/${docSig.id}`, { waitUntil: 'networkidle2' })
    const a4 = await audit(page, 'sign', ['Assinatura Digital', 'Confirmar Assinatura'])
    a4.details.forEach(d => info('  ' + d))
    if (!a4.ok) { fail('sign falhou auditoria mobile'); return false }
    // Verify canvas is visible and within viewport
    const canvas = await page.$('canvas')
    if (!canvas) { fail('canvas ausente em /trainee/sign'); return false }
    const cbox = await page.$eval('canvas', (el: any) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, w: r.width, right: r.right }
    })
    info(`  Canvas: x=${cbox.x} w=${cbox.w} right=${cbox.right}`)
    if (cbox.right > 377) { fail(`Canvas excede viewport: right=${cbox.right} > 377`); return false }
    pass('/trainee/sign responsivo OK (canvas dentro de 375px)')

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
  runTest5().then(ok => {
    console.log('\n' + (ok ? '✅ TESTE-005 PASSOU' : '❌ TESTE-005 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
