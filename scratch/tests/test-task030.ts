import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureTrainer, ensureUserAndTrainee,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'

const TRAINER_EMAIL = 'trainer.test@oportoforte.com'

async function drawSig(page: any, testId: string) {
  // Scroll into view first so coordinates land in viewport
  await page.evaluate((tid: string) => {
    const c = document.querySelector(`canvas[data-testid="${tid}"]`) as HTMLElement | null
    c?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  }, testId)
  await new Promise(r => setTimeout(r, 200))
  const box = await page.$eval(`canvas[data-testid="${testId}"]`, (el: any) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  await page.mouse.move(cx - 60, cy - 20)
  await page.mouse.down()
  await page.mouse.move(cx - 30, cy + 15, { steps: 6 })
  await page.mouse.move(cx,      cy - 10, { steps: 6 })
  await page.mouse.move(cx + 30, cy + 15, { steps: 6 })
  await page.mouse.move(cx + 60, cy - 20, { steps: 6 })
  await page.mouse.up()
  await new Promise(r => setTimeout(r, 300))
  // Verify ink reached the canvas
  const empty = await page.evaluate((tid: string) => {
    const c = document.querySelector(`canvas[data-testid="${tid}"]`) as HTMLCanvasElement
    if (!c) return true
    const ctx = c.getContext('2d')!
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i+1] !== 255 || data[i+2] !== 255) return false
    }
    return true
  }, testId)
  if (empty) throw new Error(`Canvas "${testId}" continua vazio após drawSig`)
}

export async function runTask030(): Promise<boolean> {
  header('TASK-030 — Dossier da sessão')
  let browser
  try {
    info('1. Setup BD: tenant + formador + sessão aberta')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const trainer = await ensureTrainer(tenant.id, TRAINER_EMAIL)
    const { actionId, sessionId } = await createOpenTrainingAction({
      tenantId: tenant.id, trainerId: trainer.id, courseSlug: 'task030-curso',
    })
    const { trainee } = await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })
    await enrollTrainee(actionId, trainee.id)
    // Limpar dossier prévio
    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { didacticResources: [], summary: null, trainerSignatureUrl: null, trainerSignedAt: null },
    })
    await prisma.occurrence.deleteMany({ where: { trainingActionId: actionId } })
    pass(`Setup OK — sessionId=${sessionId.slice(0,8)}`)

    info('2. Login formador, abrir /dossier')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, TRAINER_EMAIL, 'Trainer123!')
    const resp = await page.goto(`${BASE_URL}/trainer/sessions/${sessionId}/dossier`, { waitUntil: 'networkidle2' })
    if (resp?.status() !== 200) { fail(`HTTP ${resp?.status()}`); return false }
    pass('Página /dossier HTTP 200')

    info('3. Verificar 6 recursos didáticos')
    for (const r of ['Videoprojetor','Computador','Quadro','Manual do Formando','Testes','Exercícios']) {
      const el = await page.$(`[data-testid="resource-${r}"]`)
      if (!el) { fail(`Checkbox "${r}" ausente`); return false }
    }
    pass('6 checkboxes de recursos didáticos presentes')

    info('4. Verificar nome do formador no label')
    const txt = await page.$eval('body', el => el.innerText)
    if (!txt.includes('Assinatura do Formador — Trainer')) {
      fail(`Label "Assinatura do Formador — [nome]" ausente. Vi: ${txt.match(/Assinatura do Formador[^\n]*/)?.[0]}`)
      return false
    }
    pass('Label inclui nome do formador')

    info('5. Marcar 3 recursos + ativar ocorrências + preencher 1')
    await page.click('[data-testid="resource-Videoprojetor"]')
    await page.click('[data-testid="resource-Computador"]')
    await page.click('[data-testid="resource-Manual do Formando"]')
    await page.type('[data-testid="summary"]', 'Sumário de teste — abordados módulos 1 e 2.')

    // Toggle ocorrências
    await page.click('[data-testid="occ-toggle"]')
    await new Promise(r => setTimeout(r, 300))
    await page.waitForSelector('[data-testid="occ-desc-0"]')
    await page.type('[data-testid="occ-desc-0"]', 'Atraso de 15 minutos por avaria do projetor.')
    // Adicionar 2ª ocorrência
    await page.click('[data-testid="occ-add"]')
    await new Promise(r => setTimeout(r, 300))
    await page.type('[data-testid="occ-desc-1"]', 'Formando saiu mais cedo por motivo de saúde.')
    pass('Recursos, sumário e 2 ocorrências preenchidas')

    info('6. Desenhar assinatura do formador + 1 do responsável')
    await drawSig(page, 'trainer-sig')
    await drawSig(page, 'occ-sig-0')

    info('7. Submeter')
    await page.click('[data-testid="dossier-submit"]')
    await new Promise(r => setTimeout(r, 3000))
    const after = await page.$eval('body', el => el.innerText).catch(() => '')
    if (!after.includes('Dossier guardado e assinado')) {
      // Pode ter redirected
      info('Texto pós-submit (snippet): ' + after.slice(0, 400))
    }

    info('8. Verificar BD: TrainingSession atualizada')
    const updatedSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
    let allOk = true
    if (!updatedSession) { fail('Sessão sumiu'); return false }
    const expectedRes = ['Videoprojetor', 'Computador', 'Manual do Formando']
    const sortedActual = [...updatedSession.didacticResources].sort()
    const sortedExpected = [...expectedRes].sort()
    if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
      fail(`didacticResources=${JSON.stringify(updatedSession.didacticResources)} (esperava ${JSON.stringify(expectedRes)})`)
      allOk = false
    } else pass(`didacticResources=${JSON.stringify(updatedSession.didacticResources)} ✓`)

    if (!updatedSession.summary?.includes('Sumário de teste')) { fail(`summary=${updatedSession.summary}`); allOk = false } else pass(`summary preenchido ✓`)
    if (!updatedSession.trainerSignatureUrl) { fail('trainerSignatureUrl vazia'); allOk = false } else pass(`trainerSignatureUrl preenchida (${updatedSession.trainerSignatureUrl.slice(0, 60)}…) ✓`)
    if (!updatedSession.trainerSignedAt) { fail('trainerSignedAt vazio'); allOk = false } else pass(`trainerSignedAt=${updatedSession.trainerSignedAt.toISOString()} ✓`)

    info('9. Verificar Occurrences criadas')
    const occs = await prisma.occurrence.findMany({
      where: { trainingActionId: actionId },
      orderBy: { createdAt: 'asc' },
    })
    if (occs.length !== 2) { fail(`Esperava 2 ocorrências, recebido ${occs.length}`); allOk = false } else pass(`2 ocorrências criadas`)
    if (occs[0]) {
      if (!occs[0].description.includes('Atraso')) { fail(`occ[0] desc=${occs[0].description}`); allOk = false }
      if (!occs[0].trainerSignatureUrl) { fail('occ[0] trainerSignatureUrl vazia'); allOk = false } else pass(`occ[0] tem trainerSignatureUrl`)
      if (!occs[0].responsibleSignatureUrl) { fail('occ[0] responsibleSignatureUrl vazia (foi desenhada)'); allOk = false } else pass(`occ[0] tem responsibleSignatureUrl`)
      if (!occs[0].reportedById) { fail('occ[0] reportedById vazio'); allOk = false }
    }
    if (occs[1]) {
      if (!occs[1].description.includes('saiu mais cedo')) { fail(`occ[1] desc=${occs[1].description}`); allOk = false }
      if (!occs[1].trainerSignatureUrl) { fail('occ[1] trainerSignatureUrl vazia'); allOk = false }
      // occ[1] não desenhámos a assinatura do responsável, deve ser null
      if (occs[1].responsibleSignatureUrl) { fail('occ[1] responsibleSignatureUrl deveria ser null'); allOk = false } else pass(`occ[1] responsibleSignatureUrl=null como esperado`)
    }

    info('10. Bloqueio: outro formador → 403')
    const otherEmail = 'other.task030@oportoforte.com'
    await ensureTrainer(tenant.id, otherEmail)
    const otherCtx = await browser.createBrowserContext()
    const otherPage = await otherCtx.newPage()
    await loginAs(otherPage, otherEmail, 'Trainer123!')
    const otherCookies = await otherPage.cookies()
    const otherHeader = otherCookies.map(c => `${c.name}=${c.value}`).join('; ')
    const forbidden = await fetch(`${BASE_URL}/api/trainer/sessions/${sessionId}/dossier`, {
      method: 'POST', headers: { cookie: otherHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainerSignatureUrl: 'data:image/png;base64,fake' }),
    })
    if (forbidden.status !== 403) { fail(`Esperava 403, recebido ${forbidden.status}`); return false }
    pass('Formador alheio recebe 403')
    await otherCtx.close()

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
  runTask030().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-030 PASSOU' : '❌ TASK-030 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
