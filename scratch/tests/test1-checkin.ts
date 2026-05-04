import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureUserAndTrainee, ensureTrainer,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'

export async function runTest1(): Promise<boolean> {
  header('TESTE-001 — Check-in completo')
  let browser
  let allOk = true
  try {
    info('1. Setup DB: tenant, admin, trainee Maryluz, action+session aberta')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({
      email: 'admin@oportoforte.com', password: 'Admin123!',
      firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id,
    })
    const trainer = await ensureTrainer(tenant.id)
    const { trainee } = await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })
    const { actionId, sessionId } = await createOpenTrainingAction({
      tenantId: tenant.id, trainerId: trainer.id,
    })
    await enrollTrainee(actionId, trainee.id)

    // Cleanup any prior check-in for this combo
    await prisma.checkIn.deleteMany({ where: { sessionId, traineeId: trainee.id } })

    // Close any OTHER open sessions for this trainee so the dashboard banner shows mine
    await prisma.trainingSession.updateMany({
      where: {
        isOpen: true,
        id: { not: sessionId },
        trainingAction: { enrollments: { some: { traineeId: trainee.id } } },
      },
      data: { isOpen: false, isClosed: true, closedAt: new Date() },
    })

    pass(`Setup OK — sessionId=${sessionId.slice(0, 8)} traineeId=${trainee.id.slice(0, 8)}`)

    info('2. Browser: login Maryluz')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, 'maryluz@decathlon.com', 'Trainee123!')

    const url = page.url()
    if (!url.includes('/trainee/dashboard')) {
      fail(`Após login, URL = ${url} (esperava /trainee/dashboard)`)
      return false
    }
    pass('Login bem-sucedido, no dashboard')

    info('3. Verificar banner "A decorrer agora"')
    await page.waitForSelector('body')
    const bannerText = (await page.$eval('body', (el) => el.innerText)).toLowerCase()
    if (!bannerText.includes('a decorrer agora')) {
      fail('Banner "A decorrer agora" não encontrado no dashboard')
      info('Snippet do dashboard:\n' + bannerText.slice(0, 500))
      return false
    }
    pass('Banner "A decorrer agora" presente')

    if (!bannerText.includes('fazer check-in agora')) {
      fail('Botão "Fazer Check-in Agora" não encontrado')
      return false
    }
    pass('Botão "Fazer Check-in Agora" visível')

    info('4. Verificar link → navegar para página de check-in')
    const link = await page.$(`a[href="/trainee/checkin/${sessionId}"]`)
    if (!link) {
      fail(`Link a[href="/trainee/checkin/${sessionId}"] não encontrado`)
      return false
    }
    pass('Link "Fazer Check-in Agora" aponta para a sessão correta')

    const resp = await page.goto(`${BASE_URL}/trainee/checkin/${sessionId}`, { waitUntil: 'networkidle2' })
    if (resp?.status() !== 200) {
      fail(`Página de check-in retornou HTTP ${resp?.status()}`)
      return false
    }

    info('5. Página de check-in: clicar "Confirmar Presença"')
    await page.waitForSelector('button', { timeout: 15000 })
    // Find the confirm button by text
    const buttons = await page.$$('button')
    let clicked = false
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn)
      if (text?.includes('Confirmar Presença')) {
        await btn.click()
        clicked = true
        break
      }
    }
    if (!clicked) {
      fail('Botão "Confirmar Presença" não encontrado')
      return false
    }

    // Wait for either success state or error
    await new Promise(r => setTimeout(r, 2500))
    const afterText = await page.$eval('body', el => el.innerText)
    if (!afterText.includes('Check-in Realizado!')) {
      fail('Mensagem "Check-in Realizado!" não apareceu')
      info('Snippet pós-clique:\n' + afterText.slice(0, 600))
      return false
    }
    pass('Tela mostra "Check-in Realizado!"')

    info('6. Verificar registo CheckIn na BD')
    const checkin = await prisma.checkIn.findUnique({
      where: { sessionId_traineeId: { sessionId, traineeId: trainee.id } },
    })
    if (!checkin) {
      fail('Não foi criado registo CheckIn na BD')
      return false
    }
    if (!checkin.checkedInAt) { fail('checkedInAt não preenchido'); allOk = false }
    if (!checkin.ipAddress) { fail('ipAddress não preenchido'); allOk = false }
    pass(`CheckIn criado: id=${checkin.id.slice(0,8)} status=${checkin.status} ip=${checkin.ipAddress} at=${checkin.checkedInAt.toISOString()}`)

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
  runTest1().then(ok => {
    console.log('\n' + (ok ? '✅ TESTE-001 PASSOU' : '❌ TESTE-001 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
