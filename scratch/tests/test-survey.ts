import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureTrainer,
  header, pass, fail, info,
} from './harness'

const ADMIN_EMAIL = 'admin@oportoforte.com'
const TRAINER_EMAIL = 'celso@oportoforte.com'
const TRAINER_PASS = 'Celso123!'

async function getCookieHeader(email: string, password: string) {
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(() => {})
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

export async function runSurveyTest(): Promise<boolean> {
  header('TESTE-SURVEY-001 — Fluxo completo de questionário')
  let allOk = true
  let browser
  try {
    info('Setup: tenant + admin + trainer + ação SHT + Questionnaire de avaliação')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    await ensureTrainer(tenant.id, TRAINER_EMAIL)
    const sht = await prisma.course.findFirst({ where: { tenantId: tenant.id, name: 'Segurança e Higiene no Trabalho' } })
    const action = await prisma.trainingAction.findFirst({
      where: { courseId: sht!.id, tenantId: tenant.id }, orderBy: { createdAt: 'desc' },
    })
    if (!action) { fail('Ação SHT ausente — corre test-final.ts antes'); return false }

    // Criar Questionário com 4 perguntas (SCALE×3 + TEXT×1)
    let questionnaire = await prisma.questionnaire.findFirst({
      where: { tenantId: tenant.id, name: 'Avaliação Final do Curso' },
    })
    if (!questionnaire) {
      questionnaire = await prisma.questionnaire.create({
        data: {
          tenantId: tenant.id, name: 'Avaliação Final do Curso',
          format: 'PRESENCIAL', targetRole: 'TRAINEE', context: 'ACTION',
          questions: {
            create: [
              { text: 'Conteúdo do curso', type: 'SCALE', scaleMin: 1, scaleMax: 5, order: 1, isRequired: true },
              { text: 'Formador — domínio', type: 'SCALE', scaleMin: 1, scaleMax: 5, order: 2, isRequired: true },
              { text: 'Organização da ação', type: 'SCALE', scaleMin: 1, scaleMax: 5, order: 3, isRequired: true },
              { text: 'Observações', type: 'TEXT', scaleMin: 0, scaleMax: 0, order: 4, isRequired: false },
            ],
          },
        },
      })
    }
    pass(`Setup OK — questionnaireId=${questionnaire.id.slice(0, 8)}`)

    info('1. Trainer faz POST /api/survey/generate (mode=shared)')
    const trainerCookies = await getCookieHeader(TRAINER_EMAIL, TRAINER_PASS)
    const r1 = await fetch(`${BASE_URL}/api/survey/generate`, {
      method: 'POST', headers: { cookie: trainerCookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainingActionId: action.id, questionnaireId: questionnaire.id, mode: 'shared' }),
    })
    if (r1.status !== 200) { fail(`HTTP ${r1.status}: ${await r1.text()}`); return false }
    const j1 = await r1.json()
    if (!j1.url || !j1.qrCodeBase64) { fail(`Resposta inesperada: ${JSON.stringify(j1)}`); return false }
    pass(`Survey URL: ${j1.url}`)

    info('2. Abrir URL em incognito (público — sem login) e percorrer o wizard')
    browser = await launchBrowser()
    const ctx = await browser.createBrowserContext()
    const guest = await ctx.newPage()
    const r2 = await guest.goto(j1.url, { waitUntil: 'networkidle2' })
    if (r2?.status() !== 200) { fail(`HTTP ${r2?.status()} (deve ser 200 sem auth)`); return false }
    await guest.waitForSelector('[data-testid="survey-question"]', { timeout: 10000 })
    pass('Página de survey acessível sem login')

    info('3. Pergunta 1 (SCALE) → clicar 5')
    await guest.click('[data-testid="scale-5"]')
    await guest.click('[data-testid="btn-next"]')
    await new Promise(r => setTimeout(r, 200))

    info('4. Pergunta 2 (SCALE) → clicar 4')
    await guest.click('[data-testid="scale-4"]')
    await guest.click('[data-testid="btn-next"]')
    await new Promise(r => setTimeout(r, 200))

    info('5. Pergunta 3 (SCALE) → clicar 5')
    await guest.click('[data-testid="scale-5"]')
    await guest.click('[data-testid="btn-next"]')
    await new Promise(r => setTimeout(r, 200))

    info('6. Pergunta 4 (TEXT) → escrever observação (opcional)')
    await guest.type('[data-testid="text-input"]', 'Excelente formação, muito útil.')
    const submitResponses: any[] = []
    guest.on('response', async (r) => {
      if (r.url().includes('/api/survey/') && r.url().includes('/submit')) {
        let body = ''
        try { body = await r.text() } catch {}
        submitResponses.push({ url: r.url(), status: r.status(), body: body.slice(0, 200) })
      }
    })
    await guest.click('[data-testid="btn-submit"]')
    await new Promise(r => setTimeout(r, 6000))
    info(`Submit responses: ${JSON.stringify(submitResponses)}`)

    const after = await guest.$eval('body', el => el.innerText)
    if (!after.includes('Obrigado')) {
      fail('Página de agradecimento não apareceu')
      info('Body snippet: ' + after.slice(0, 500))
      return false
    }
    pass('Página "Obrigado!" exibida')
    await ctx.close()

    info('7. Validar BD: respondedAt preenchido + 4 answers')
    const tokenFromUrl = (j1.url as string).split('/').pop()
    const response = await prisma.questionnaireResponse.findUnique({
      where: { token: tokenFromUrl },
      include: { answers: { include: { question: true } } },
    })
    if (!response) { fail('Response não encontrado'); return false }
    if (!response.respondedAt) { fail('respondedAt vazio'); allOk = false }
    else pass(`respondedAt=${response.respondedAt.toISOString()}`)
    if (response.answers.length !== 4) { fail(`Esperava 4 answers, encontrei ${response.answers.length}`); allOk = false }
    else pass(`4 answers criadas`)
    const scaleAvg = response.answers.filter(a => a.scaleValue !== null).reduce((s, a) => s + (a.scaleValue || 0), 0) / 3
    if (scaleAvg !== (5 + 4 + 5) / 3) { fail(`Médias scale erradas: ${scaleAvg}`); allOk = false }
    else pass(`Scale answers: 5,4,5 (média ${scaleAvg.toFixed(2)})`)
    const textAns = response.answers.find(a => a.question.type === 'TEXT')
    if (!textAns?.textValue?.includes('Excelente')) { fail('Observação não guardada'); allOk = false }
    else pass(`Texto: "${textAns.textValue}"`)

    info('8. Submeter mesmo token de novo → 409')
    const r3 = await fetch(`${BASE_URL}/api/survey/${tokenFromUrl}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [] }),
    })
    if (r3.status !== 409) { fail(`Esperava 409 (já respondido), recebeu ${r3.status}`); allOk = false }
    else pass('Re-submissão bloqueada com 409')

    info('9. Reabrir URL → mostra "Já respondeu"')
    const ctx2 = await browser.createBrowserContext()
    const g2 = await ctx2.newPage()
    await g2.goto(j1.url, { waitUntil: 'networkidle2' })
    const txt = await g2.$eval('body', el => el.innerText)
    if (!txt.includes('Já respondeu')) { fail('Página de duplicação ausente'); allOk = false }
    else pass('Página de duplicação mostrada')
    await ctx2.close()

    info('10. /admin/analytics/satisfaction reflecte resposta')
    const adminCookies = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const r4 = await fetch(`${BASE_URL}/api/admin/analytics/satisfaction`, { headers: { cookie: adminCookies } })
    if (r4.status !== 200) { fail(`HTTP ${r4.status}`); allOk = false }
    else {
      const a = await r4.json()
      if (a.totalResponded < 1) { fail(`totalResponded=${a.totalResponded}`); allOk = false }
      else pass(`Analytics: globalAvg=${a.globalAverage} totalResponded=${a.totalResponded} responseRate=${a.responseRate}%`)
    }

    info('11. PDF Relatório de Satisfação')
    const r5 = await fetch(`${BASE_URL}/api/admin/actions/${action.id}/satisfaction-pdf`, { headers: { cookie: adminCookies } })
    if (r5.status !== 200) { fail(`HTTP ${r5.status}`); allOk = false }
    else {
      const buf = Buffer.from(await r5.arrayBuffer())
      if (!buf.slice(0, 4).toString('ascii').startsWith('%PDF')) { fail('Não é PDF'); allOk = false }
      else pass(`PDF Satisfação: ${(buf.length / 1024).toFixed(1)} KB`)
    }

    info('12. /admin/actions/[id]/surveys mostra contador')
    const r6 = await fetch(`${BASE_URL}/api/admin/actions/${action.id}/surveys`, { headers: { cookie: adminCookies } })
    if (r6.status !== 200) { fail(`HTTP ${r6.status}`); allOk = false }
    else {
      const j = await r6.json()
      if (j.responded < 1) { fail(`responded=${j.responded}`); allOk = false }
      else pass(`Survey counter: ${j.responded}/${j.total}`)
    }

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
  runSurveyTest().then(ok => {
    console.log('\n' + (ok ? '✅ TESTE-SURVEY-001 PASSOU' : '❌ FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
