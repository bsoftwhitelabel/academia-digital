import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureTrainer, ensureUserAndTrainee,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'

const TRAINER_EMAIL = 'trainer.test@oportoforte.com'

export async function runTask029(): Promise<boolean> {
  header('TASK-029 — Geração de QR Code')
  let browser
  try {
    info('1. Setup: tenant + formador + sessão aberta')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const trainer = await ensureTrainer(tenant.id, TRAINER_EMAIL)
    const { actionId, sessionId } = await createOpenTrainingAction({
      tenantId: tenant.id, trainerId: trainer.id, courseSlug: 'task029-curso',
    })
    const { trainee } = await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })
    await enrollTrainee(actionId, trainee.id)

    // Reset campos QR
    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { checkinQrCode: null, checkinQrExpiresAt: null },
    })
    pass(`Setup OK — sessionId=${sessionId.slice(0,8)}`)

    info('2. POST /api/checkin/[id]/qr (cookies do formador)')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, TRAINER_EMAIL, 'Trainer123!')
    const cookies = await page.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const apiResp = await fetch(`${BASE_URL}/api/checkin/${sessionId}/qr`, {
      method: 'POST', headers: { cookie: cookieHeader },
    })
    if (apiResp.status !== 200) {
      fail(`HTTP ${apiResp.status}: ${await apiResp.text()}`)
      return false
    }
    const qrData = await apiResp.json()
    if (!qrData.token || qrData.token.length < 10) { fail('Token inválido'); return false }
    if (!qrData.url.includes(`/trainee/checkin/${sessionId}?qr=${qrData.token}`)) {
      fail(`URL inesperado: ${qrData.url}`); return false
    }
    pass(`API OK — token=${qrData.token.slice(0,12)}… url contém sessionId+token`)

    info('3. Verificar BD: checkinQrCode e checkinQrExpiresAt preenchidos')
    const after = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
    if (after?.checkinQrCode !== qrData.token) { fail('checkinQrCode não bate'); return false }
    if (!after?.checkinQrExpiresAt) { fail('checkinQrExpiresAt vazio'); return false }
    pass(`BD: token guardado, expiresAt=${after.checkinQrExpiresAt.toISOString()}`)

    info('4. Idempotência: chamar de novo deve devolver mesmo token')
    const apiResp2 = await fetch(`${BASE_URL}/api/checkin/${sessionId}/qr`, {
      method: 'POST', headers: { cookie: cookieHeader },
    })
    const qrData2 = await apiResp2.json()
    if (qrData2.token !== qrData.token) {
      fail(`Token mudou na 2ª chamada: ${qrData.token} → ${qrData2.token}`)
      return false
    }
    pass('Token reutilizado (não regenera enquanto válido)')

    info('5. UI: abrir modal QR e validar imagem')
    await page.goto(`${BASE_URL}/trainer/sessions/${sessionId}/attendance`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('[data-testid="qr-trigger"]', { timeout: 10000 })
    await page.click('[data-testid="qr-trigger"]')

    // Esperar pelo modal e pela imagem
    await page.waitForSelector('[data-testid="qr-modal"]', { timeout: 5000 })
    await page.waitForSelector('[data-testid="qr-image"]', { timeout: 10000 })
    const imgSrc = await page.$eval('[data-testid="qr-image"]', (el: any) => el.src)
    if (!imgSrc.startsWith('data:image/png;base64,')) {
      fail(`src do QR não é data URL: ${imgSrc.slice(0, 60)}`)
      return false
    }
    if (imgSrc.length < 500) { fail('Data URL do QR muito curta'); return false }
    pass(`Modal renderiza imagem PNG (${Math.round(imgSrc.length / 1024)} KB data URL)`)

    info('6. Verificar texto "Aponte a câmara para fazer check-in"')
    const modalTxt = await page.$eval('[data-testid="qr-modal"]', (el: any) => el.innerText)
    if (!modalTxt.includes('Aponte a câmara para fazer check-in')) {
      fail('Texto não encontrado no modal')
      info('Modal text: ' + modalTxt.slice(0, 200))
      return false
    }
    pass('Texto correto presente')

    info('7. Verificar fundo escuro full-screen')
    const bg = await page.$eval('[data-testid="qr-modal"]', (el: any) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height, classes: el.className }
    })
    if (bg.x !== 0 || bg.y !== 0) { fail(`Modal não começa em 0,0: ${bg.x},${bg.y}`); return false }
    if (!bg.classes.includes('bg-black') && !bg.classes.includes('bg-gray-9')) {
      fail(`Modal não tem fundo escuro nas classes: ${bg.classes}`); return false
    }
    pass(`Full-screen: ${bg.w}x${bg.h} com fundo escuro`)

    info('8. Botão Fechar funciona')
    await page.click('[data-testid="qr-close"]')
    await new Promise(r => setTimeout(r, 400))
    const stillThere = await page.$('[data-testid="qr-modal"]')
    if (stillThere) { fail('Modal não fechou após click em Fechar'); return false }
    pass('Modal fecha ao clicar em Fechar')

    info('9. Bloqueio: outro formador → 403 ao gerar QR')
    const otherEmail = 'other.task029@oportoforte.com'
    await ensureTrainer(tenant.id, otherEmail)
    const otherCtx = await browser.createBrowserContext()
    const otherPage = await otherCtx.newPage()
    await loginAs(otherPage, otherEmail, 'Trainer123!')
    const otherCookies = await otherPage.cookies()
    const otherHeader = otherCookies.map(c => `${c.name}=${c.value}`).join('; ')
    const forbidden = await fetch(`${BASE_URL}/api/checkin/${sessionId}/qr`, {
      method: 'POST', headers: { cookie: otherHeader },
    })
    if (forbidden.status !== 403) { fail(`Esperava 403, recebido ${forbidden.status}`); return false }
    pass('Formador alheio recebe 403')
    await otherCtx.close()

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
  runTask029().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-029 PASSOU' : '❌ TASK-029 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
