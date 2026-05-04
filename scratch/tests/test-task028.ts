import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureTrainer, ensureUserAndTrainee,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'

const TRAINER_EMAIL = 'trainer.test@oportoforte.com'
const TRAINER_PASSWORD = 'Trainer123!'

async function buildSessionWithTwoTrainees(tenantId: string, trainerId: string) {
  const { actionId, sessionId } = await createOpenTrainingAction({
    tenantId, trainerId, courseSlug: 'task028-curso',
  })
  const t1 = (await ensureUserAndTrainee({
    email: 'maryluz@decathlon.com', password: 'Trainee123!',
    firstName: 'Maryluz', lastName: 'Decathlon', tenantId,
  })).trainee
  const t2 = (await ensureUserAndTrainee({
    email: 'jose.task028@decathlon.com', password: 'Trainee123!',
    firstName: 'José', lastName: 'Pinto', tenantId,
  })).trainee
  await enrollTrainee(actionId, t1.id)
  await enrollTrainee(actionId, t2.id)
  // Limpar check-ins prévios
  await prisma.checkIn.deleteMany({ where: { sessionId, traineeId: { in: [t1.id, t2.id] } } })
  return { actionId, sessionId, t1, t2 }
}

export async function runTask028(): Promise<boolean> {
  header('TASK-028 — Controlo de presenças ao vivo')
  let browser
  try {
    info('1. Setup: tenant + formador + sessão aberta + 2 formandos')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const trainer = await ensureTrainer(tenant.id, TRAINER_EMAIL)
    const { sessionId, t1, t2 } = await buildSessionWithTwoTrainees(tenant.id, trainer.id)
    pass(`Setup OK — sessionId=${sessionId.slice(0,8)} t1=${t1.id.slice(0,8)} t2=${t2.id.slice(0,8)}`)

    info('2. Login formador')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, TRAINER_EMAIL, TRAINER_PASSWORD)

    info('3. GET /api/checkin/[id]/status (cookies)')
    const cookies = await page.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const statusResp = await fetch(`${BASE_URL}/api/checkin/${sessionId}/status`, { headers: { cookie: cookieHeader } })
    if (statusResp.status !== 200) { fail(`HTTP ${statusResp.status}`); return false }
    const st = await statusResp.json()
    if (st.total !== 2) { fail(`total=${st.total} (esperava 2)`); return false }
    if (st.present !== 0) { fail(`present=${st.present} (esperava 0)`); return false }
    if (st.absent !== 2) { fail(`absent=${st.absent} (esperava 2)`); return false }
    pass(`Status OK — total=${st.total} present=${st.present} absent=${st.absent}`)

    info('4. Página /trainer/sessions/[id]/attendance')
    const navResp = await page.goto(`${BASE_URL}/trainer/sessions/${sessionId}/attendance`, { waitUntil: 'networkidle2' })
    if (navResp?.status() !== 200) { fail(`HTTP ${navResp?.status()}`); return false }
    // Esperar que SWR carregue
    await page.waitForSelector('[data-testid="counter-card"]', { timeout: 10000 })
    await new Promise(r => setTimeout(r, 600))
    const txt = await page.$eval('body', el => el.innerText)
    if (!txt.includes('Controlo de Presenças')) { fail('Título ausente'); return false }
    if (!txt.includes('Presenças confirmadas')) { fail('Card contador ausente'); return false }
    if (!txt.includes(`Todos (2)`)) { fail('Filtro "Todos (2)" ausente'); return false }
    pass('Página renderizou com contador e filtros corretos')

    info('5. Manual check-in via UI')
    const cinBtn = await page.$(`[data-testid="checkin-${t1.id}"]`)
    if (!cinBtn) { fail('Botão Check-in para t1 não encontrado'); return false }
    await cinBtn.click()
    await new Promise(r => setTimeout(r, 1500))
    // Validar no DB
    const ci = await prisma.checkIn.findUnique({
      where: { sessionId_traineeId: { sessionId, traineeId: t1.id } },
    })
    if (!ci || ci.status !== 'MANUAL' || !ci.isManual) {
      fail(`CheckIn não criado como MANUAL. Estado: ${JSON.stringify(ci)}`)
      return false
    }
    if (!ci.registeredById) { fail('registeredById vazio'); return false }
    pass(`Manual check-in OK: status=MANUAL isManual=true ip=${ci.ipAddress}`)

    info('6. Anular check-in via UI')
    // Esperar a UI atualizar via SWR mutate
    await page.waitForSelector(`[data-testid="cancel-${t1.id}"]`, { timeout: 5000 })
    const cancelBtn = await page.$(`[data-testid="cancel-${t1.id}"]`)
    await cancelBtn!.click()
    await new Promise(r => setTimeout(r, 1500))
    const ci2 = await prisma.checkIn.findUnique({
      where: { sessionId_traineeId: { sessionId, traineeId: t1.id } },
    })
    if (ci2) { fail('CheckIn não foi anulado (DELETE falhou)'); return false }
    pass('Anular check-in: registo removido da BD')

    info('7. SWR polling: criar check-in directo na BD e ver UI atualizar')
    await prisma.checkIn.create({
      data: { sessionId, traineeId: t2.id, status: 'CHECKED_IN', isManual: false },
    })
    // Aguardar polling (10s) ou refrescar manualmente
    await new Promise(r => setTimeout(r, 12000))
    const txt2 = await page.$eval('body', el => el.innerText)
    if (!txt2.includes('Presente') && !txt2.includes('Manual')) {
      fail('UI não atualizou após polling SWR (não viu badge Presente)')
      return false
    }
    pass('SWR polling atualiza UI (badge Presente apareceu)')

    info('8. Bloqueio: outro formador → 403 no status (contexto isolado)')
    const otherTrainerEmail = 'other.task028@oportoforte.com'
    await ensureTrainer(tenant.id, otherTrainerEmail)
    const otherCtx = await browser.createBrowserContext()
    const otherPage = await otherCtx.newPage()
    await loginAs(otherPage, otherTrainerEmail, 'Trainer123!')
    const otherCookies = await otherPage.cookies()
    const otherHeader = otherCookies.map(c => `${c.name}=${c.value}`).join('; ')
    const forbidden = await fetch(`${BASE_URL}/api/checkin/${sessionId}/status`, { headers: { cookie: otherHeader } })
    if (forbidden.status !== 403) { fail(`Esperava 403 do outro formador, recebido ${forbidden.status}`); return false }
    pass('Outro formador → 403 no /status (autorização correta)')
    await otherCtx.close()

    // Voltar à página original e refrescar (o SWR pode ter cookies stale, mas como o outro contexto está fechado, está OK)
    await page.bringToFront()
    await page.reload({ waitUntil: 'networkidle2' })
    await page.waitForSelector('[data-testid="counter-card"]', { timeout: 10000 })

    info('9. Finalizar sessão (botão na UI)')
    const finalizeBtn = await page.$(`[data-testid="finalize-button"]`)
    if (!finalizeBtn) { fail('Botão Finalizar Sessão não encontrado'); return false }
    await finalizeBtn.click()
    await page.waitForSelector(`[data-testid="confirm-finalize"]`, { timeout: 5000 })
    await new Promise(r => setTimeout(r, 400))
    const dialogTxt = await page.$eval('body', el => el.innerText)
    info('Body após abrir dialog (snippet 200):\n' + dialogTxt.slice(0, 600))
    const confirm = await page.$(`[data-testid="confirm-finalize"]`)
    // Capturar fetch para ver se chegou
    const responses: any[] = []
    page.on('response', (r) => {
      if (r.url().includes('/close')) responses.push({ url: r.url(), status: r.status() })
    })
    await confirm!.click()
    await new Promise(r => setTimeout(r, 5000))
    info('Responses /close: ' + JSON.stringify(responses))
    const finalized = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
    if (!finalized) { fail('Sessão sumiu da BD'); return false }
    if (finalized.isOpen) {
      fail('isOpen ainda true')
      info('Estado BD: ' + JSON.stringify({ isOpen: finalized.isOpen, isClosed: finalized.isClosed, closedAt: finalized.closedAt }))
      const errOnPage = await page.$eval('body', el => el.innerText).catch(() => '')
      info('Body após click confirm:\n' + errOnPage.slice(0, 600))
      return false
    }
    if (!finalized.isClosed) { fail('isClosed != true'); return false }
    if (!finalized.closedAt) { fail('closedAt vazio'); return false }
    pass(`Sessão fechada: isOpen=false isClosed=true closedAt=${finalized.closedAt.toISOString()}`)

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
  runTask028().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-028 PASSOU' : '❌ TASK-028 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
