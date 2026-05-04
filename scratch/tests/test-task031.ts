import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureTrainer, ensureUserAndTrainee,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'
import { DocumentType } from '@prisma/client'

const TRAINER_EMAIL = 'trainer.test@oportoforte.com'

export async function runTask031(): Promise<boolean> {
  header('TASK-031 — Habilitar formandos para assinatura')
  let browser
  try {
    info('1. Setup: tenant + formador + sessão aberta + 3 formandos (2 com check-in)')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const trainer = await ensureTrainer(tenant.id, TRAINER_EMAIL)
    const { actionId, sessionId } = await createOpenTrainingAction({
      tenantId: tenant.id, trainerId: trainer.id, courseSlug: 'task031-curso',
    })
    const t1 = (await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })).trainee
    const t2 = (await ensureUserAndTrainee({
      email: 'jose.task031@decathlon.com', password: 'Trainee123!',
      firstName: 'José', lastName: 'Pinto', tenantId: tenant.id,
    })).trainee
    const t3 = (await ensureUserAndTrainee({
      email: 'ana.task031@decathlon.com', password: 'Trainee123!',
      firstName: 'Ana', lastName: 'Costa', tenantId: tenant.id,
    })).trainee
    await enrollTrainee(actionId, t1.id)
    await enrollTrainee(actionId, t2.id)
    await enrollTrainee(actionId, t3.id)
    await prisma.checkIn.deleteMany({ where: { sessionId } })
    await prisma.checkIn.create({
      data: { sessionId, traineeId: t1.id, status: 'CHECKED_IN', isManual: false },
    })
    await prisma.checkIn.create({
      data: { sessionId, traineeId: t2.id, status: 'MANUAL', isManual: true, registeredById: 'trainer-id' },
    })
    // t3 sem check-in (ABSENT)
    await prisma.documentSignature.deleteMany({ where: { sessionId } })
    pass(`Setup OK — sessionId=${sessionId.slice(0,8)}`)

    info('2. Login formador, abrir /signatures')
    browser = await launchBrowser()
    const page = await browser.newPage()
    await loginAs(page, TRAINER_EMAIL, 'Trainer123!')
    const resp = await page.goto(`${BASE_URL}/trainer/sessions/${sessionId}/signatures`, { waitUntil: 'networkidle2' })
    if (resp?.status() !== 200) { fail(`HTTP ${resp?.status()}`); return false }
    pass('Página /signatures HTTP 200')

    info('3. Verificar lista: 2 com check-in (t1, t2), nenhum com t3')
    await page.waitForSelector(`[data-testid="sig-row-${t1.id}"]`, { timeout: 5000 })
    const txt = await page.$eval('body', el => el.innerText)
    if (!txt.includes('Maryluz')) { fail('Maryluz não listada'); return false }
    if (!txt.includes('José Pinto')) { fail('José Pinto não listado'); return false }
    if (txt.includes('Ana Costa')) { fail('Ana Costa apareceu (não tinha check-in)'); return false }
    pass('Lista correta: Maryluz e José; Ana excluída')

    info('4. Verificar badges PENDING para ambos')
    const t1Row = await page.$eval(`[data-testid="sig-row-${t1.id}"]`, el => el.textContent || '')
    if (!t1Row.includes('PENDING')) { fail(`Linha t1: badge errado — ${t1Row}`); return false }
    pass('Badge PENDING visível para t1 e t2')

    info('5. Selecionar 2 formandos + Habilitar')
    await page.click(`[data-testid="sig-check-${t1.id}"]`)
    await page.click(`[data-testid="sig-check-${t2.id}"]`)
    await new Promise(r => setTimeout(r, 200))
    await page.click('[data-testid="enable-submit"]')
    // Esperar até "A habilitar…" desaparecer
    await page.waitForFunction(
      () => !document.body.innerText.includes('A habilitar…'),
      { timeout: 30000 }
    )

    const afterTxt = await page.$eval('body', el => el.innerText)
    if (!afterTxt.includes('habilitada(s)')) {
      fail('Mensagem de sucesso não apareceu')
      info('Snippet: ' + afterTxt.slice(0, 400))
      return false
    }
    pass('UI: confirmou "X assinatura(s) habilitada(s)"')

    info('6. Verificar BD: 2 DocumentSignature ENABLED')
    const sigs = await prisma.documentSignature.findMany({
      where: { sessionId, documentType: DocumentType.REGISTO_PRESENCAS },
    })
    if (sigs.length !== 2) { fail(`Esperava 2 signatures, encontrei ${sigs.length}`); return false }
    let bdOk = true
    for (const s of sigs) {
      if (s.status !== 'ENABLED') { fail(`signature ${s.id.slice(0,6)} status=${s.status}`); bdOk = false }
      if (!s.enabledAt) { fail(`signature ${s.id.slice(0,6)} enabledAt vazio`); bdOk = false }
      if (!s.enabledById) { fail(`signature ${s.id.slice(0,6)} enabledById vazio`); bdOk = false }
    }
    if (!bdOk) return false
    pass(`2 DocumentSignature criadas com status=ENABLED, enabledAt+enabledById`)

    info('7. Verificar UI atualizou para badge ENABLED (após mutate)')
    await new Promise(r => setTimeout(r, 1500))
    const t1Row2 = await page.$eval(`[data-testid="sig-row-${t1.id}"]`, el => el.textContent || '')
    if (!t1Row2.includes('ENABLED')) { fail(`Linha t1 ainda sem ENABLED: ${t1Row2}`); return false }
    pass('UI atualizou: badge ENABLED visível')

    info('8. Bloqueio: traineeId sem check-in → não habilita')
    const cookies = await page.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const respSkip = await fetch(`${BASE_URL}/api/trainer/sessions/${sessionId}/signatures/enable`, {
      method: 'POST', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeIds: [t3.id] }),
    })
    const dataSkip = await respSkip.json()
    if (dataSkip.enabled !== 0) { fail(`enabled=${dataSkip.enabled}, esperava 0`); return false }
    if (!dataSkip.skippedIds?.includes(t3.id)) { fail(`t3 não veio em skippedIds: ${JSON.stringify(dataSkip)}`); return false }
    pass('Formando sem check-in → skipped, não habilitado')

    info('9. Sessão encerrada → reason obrigatório')
    await prisma.trainingSession.update({ where: { id: sessionId }, data: { isOpen: false, isClosed: true, closedAt: new Date() } })
    const respNoReason = await fetch(`${BASE_URL}/api/trainer/sessions/${sessionId}/signatures/enable`, {
      method: 'POST', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeIds: [t1.id] }),
    })
    if (respNoReason.status !== 400) { fail(`Esperava 400 sem reason, recebido ${respNoReason.status}`); return false }
    const dataNoReason = await respNoReason.json()
    if (!dataNoReason.error?.toLowerCase().includes('justificação')) {
      fail(`Mensagem errada: ${dataNoReason.error}`); return false
    }
    pass('Sessão encerrada sem justificação → 400 com erro adequado')

    info('10. Sessão encerrada COM reason → sucesso e enabledNotes guardado')
    // Reset signature status to test re-enable
    await prisma.documentSignature.updateMany({
      where: { sessionId, traineeId: t1.id }, data: { status: 'PENDING', enabledNotes: null },
    })
    const respReason = await fetch(`${BASE_URL}/api/trainer/sessions/${sessionId}/signatures/enable`, {
      method: 'POST', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeIds: [t1.id], reason: 'Sessão encerrada antes do tempo. Justificado.' }),
    })
    if (respReason.status !== 200) {
      fail(`Esperava 200, recebido ${respReason.status}: ${await respReason.text()}`); return false
    }
    const sigT1 = await prisma.documentSignature.findFirst({
      where: { sessionId, traineeId: t1.id, documentType: DocumentType.REGISTO_PRESENCAS },
    })
    if (!sigT1?.enabledNotes?.includes('Sessão encerrada antes do tempo')) {
      fail(`enabledNotes não guardada: ${sigT1?.enabledNotes}`); return false
    }
    pass(`enabledNotes guardada: "${sigT1.enabledNotes.slice(0, 60)}…"`)

    info('11. Bloqueio: outro formador → 403 GET e POST')
    const otherEmail = 'other.task031@oportoforte.com'
    await ensureTrainer(tenant.id, otherEmail)
    const otherCtx = await browser.createBrowserContext()
    const otherPage = await otherCtx.newPage()
    await loginAs(otherPage, otherEmail, 'Trainer123!')
    const otherCookies = await otherPage.cookies()
    const otherHeader = otherCookies.map(c => `${c.name}=${c.value}`).join('; ')
    const r1 = await fetch(`${BASE_URL}/api/trainer/sessions/${sessionId}/signatures/enable`, { headers: { cookie: otherHeader } })
    if (r1.status !== 403) { fail(`GET esperava 403, recebeu ${r1.status}`); return false }
    const r2 = await fetch(`${BASE_URL}/api/trainer/sessions/${sessionId}/signatures/enable`, {
      method: 'POST', headers: { cookie: otherHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeIds: [t1.id], reason: 'tentativa' }),
    })
    if (r2.status !== 403) { fail(`POST esperava 403, recebeu ${r2.status}`); return false }
    pass('Outro formador → 403 em GET e POST')
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
  runTask031().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-031 PASSOU' : '❌ TASK-031 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
