import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureUserAndTrainee,
  header, pass, fail, info,
} from './harness'
import { DocumentType, SignatureStatus } from '@prisma/client'

export async function runTest4(): Promise<boolean> {
  header('TESTE-004 — Assinatura digital')
  let browser
  try {
    info('1. Setup: tenant, trainee Maryluz, DocumentSignature ENABLED')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const { trainee } = await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })

    // Limpar assinaturas anteriores
    await prisma.documentSignature.deleteMany({
      where: { traineeId: trainee.id, documentType: DocumentType.FICHA_IDENTIFICACAO },
    })
    const docSig = await prisma.documentSignature.create({
      data: {
        traineeId: trainee.id,
        documentType: DocumentType.FICHA_IDENTIFICACAO,
        status: SignatureStatus.ENABLED,
        enabledAt: new Date(),
      },
    })
    pass(`DocumentSignature criada id=${docSig.id.slice(0,8)} status=ENABLED`)

    info('2. Login Maryluz')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, 'maryluz@decathlon.com', 'Trainee123!')
    if (!page.url().includes('/trainee/dashboard')) {
      fail('Login não redirecionou para /trainee/dashboard, URL=' + page.url())
      return false
    }

    info(`3. Aceder /trainee/sign/${docSig.id.slice(0,8)}…`)
    const resp = await page.goto(`${BASE_URL}/trainee/sign/${docSig.id}`, { waitUntil: 'networkidle2' })
    if (resp?.status() !== 200) {
      fail(`HTTP ${resp?.status()} na página de assinatura`)
      return false
    }
    await page.waitForSelector('canvas', { timeout: 5000 })
    pass('Página de assinatura carregou, canvas presente')

    info('4. Desenhar no canvas (mouse drag)')
    const box = await page.$eval('canvas', (el) => {
      const r = (el as HTMLCanvasElement).getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })
    info(`Canvas bbox: x=${box.x} y=${box.y} w=${box.w} h=${box.h}`)
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2

    // 1st stroke: diagonal
    await page.mouse.move(cx - 80, cy - 30)
    await page.mouse.down()
    await page.mouse.move(cx - 40, cy + 10, { steps: 8 })
    await page.mouse.move(cx,      cy - 20, { steps: 8 })
    await page.mouse.move(cx + 40, cy + 10, { steps: 8 })
    await page.mouse.move(cx + 80, cy - 30, { steps: 8 })
    await page.mouse.up()

    // 2nd stroke: underline
    await page.mouse.move(cx - 60, cy + 30)
    await page.mouse.down()
    await page.mouse.move(cx + 60, cy + 30, { steps: 10 })
    await page.mouse.up()

    await new Promise(r => setTimeout(r, 400))

    // Validate the signature_pad sees ink
    const isEmpty = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement
      const ctx = c.getContext('2d')!
      const data = ctx.getImageData(0, 0, c.width, c.height).data
      // Look for any non-white pixel
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 255 || data[i+1] !== 255 || data[i+2] !== 255) return false
      }
      return true
    })
    if (isEmpty) { fail('Canvas continua vazio após desenhar'); return false }
    pass('Tinta detectada no canvas')

    info('5. Clicar "Confirmar Assinatura"')
    const buttons = await page.$$('button')
    let clicked = false
    for (const b of buttons) {
      const t = await page.evaluate(el => el.textContent, b)
      if (t?.includes('Confirmar Assinatura')) {
        const isDisabled = await page.evaluate(el => (el as HTMLButtonElement).disabled, b)
        if (isDisabled) { fail('Botão "Confirmar Assinatura" está disabled'); return false }
        await b.click()
        clicked = true
        break
      }
    }
    if (!clicked) { fail('Botão "Confirmar Assinatura" não encontrado'); return false }

    // Esperar a confirmação
    await new Promise(r => setTimeout(r, 3000))
    const afterTxt = await page.$eval('body', el => el.innerText)
    if (!afterTxt.includes('Documento Assinado')) {
      fail('Mensagem "Documento Assinado!" não apareceu')
      info('Snippet:\n' + afterTxt.slice(0, 600))
      return false
    }
    pass('UI confirma "Documento Assinado!"')

    info('6. Verificar BD')
    const after = await prisma.documentSignature.findUnique({ where: { id: docSig.id } })
    if (!after) { fail('DocumentSignature desapareceu'); return false }
    let allOk = true
    if (after.status !== 'SIGNED') { fail(`status=${after.status} (esperava SIGNED)`); allOk = false } else pass('status=SIGNED ✓')
    if (!after.signatureUrl) { fail('signatureUrl vazia'); allOk = false } else pass(`signatureUrl preenchida (${after.signatureUrl.slice(0, 60)}…)`)
    if (!after.signedAt) { fail('signedAt vazio'); allOk = false } else pass(`signedAt=${after.signedAt.toISOString()} ✓`)
    if (!after.ipAddress) { fail('ipAddress vazio'); allOk = false } else pass(`ipAddress=${after.ipAddress} ✓`)
    if (!after.userAgent) { fail('userAgent vazio'); allOk = false } else pass(`userAgent registado (${after.userAgent.slice(0, 40)}…)`)

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
  runTest4().then(ok => {
    console.log('\n' + (ok ? '✅ TESTE-004 PASSOU' : '❌ TESTE-004 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
