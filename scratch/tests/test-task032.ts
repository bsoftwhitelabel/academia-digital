import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureTrainer, ensureUserAndTrainee, ensureAdminUser,
  createOpenTrainingAction, enrollTrainee,
  header, pass, fail, info,
} from './harness'

const ADMIN_EMAIL = 'admin@oportoforte.com'

async function getCookieHeader(email: string, password: string) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

export async function runTask032(): Promise<boolean> {
  header('TASK-032 — Infraestrutura PDF + route /api/pdf/[actionId]/[docType]')
  try {
    info('1. Setup: tenant + admin + ação + 2 formandos inscritos')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({
      email: ADMIN_EMAIL, password: 'Admin123!',
      firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id,
    })
    const trainer = await ensureTrainer(tenant.id)
    const { actionId } = await createOpenTrainingAction({
      tenantId: tenant.id, trainerId: trainer.id, courseSlug: 'task032-curso',
    })
    const t1 = (await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })).trainee
    await enrollTrainee(actionId, t1.id)
    pass(`Setup OK — actionId=${actionId.slice(0,8)}`)

    info('2. Login admin → cookies')
    const cookieHeader = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    pass('Cookies obtidas')

    info('3. GET /api/pdf/[actionId]/REGISTO_PRESENCAS')
    const r1 = await fetch(`${BASE_URL}/api/pdf/${actionId}/REGISTO_PRESENCAS`, {
      headers: { cookie: cookieHeader },
    })
    if (r1.status !== 200) { fail(`HTTP ${r1.status}: ${await r1.text()}`); return false }
    const ct = r1.headers.get('content-type')
    const cd = r1.headers.get('content-disposition')
    if (!ct?.includes('application/pdf')) { fail(`Content-Type=${ct}`); return false }
    if (!cd?.includes('attachment')) { fail(`Content-Disposition=${cd}`); return false }
    if (!cd?.includes('folha-presencas')) { fail(`Filename inesperado: ${cd}`); return false }
    const buf = Buffer.from(await r1.arrayBuffer())
    if (!buf.slice(0, 4).toString('ascii').startsWith('%PDF')) {
      fail(`Resposta não é PDF (primeiros 4 bytes: ${buf.slice(0,4).toString('hex')})`)
      return false
    }
    pass(`PDF gerado ${buf.length} bytes (REGISTO_PRESENCAS)`)

    info('4. GET /api/pdf/[actionId]/FICHA_IDENTIFICACAO')
    const r2 = await fetch(`${BASE_URL}/api/pdf/${actionId}/FICHA_IDENTIFICACAO`, {
      headers: { cookie: cookieHeader },
    })
    if (r2.status !== 200) { fail(`HTTP ${r2.status}`); return false }
    const buf2 = Buffer.from(await r2.arrayBuffer())
    if (!buf2.slice(0, 4).toString('ascii').startsWith('%PDF')) {
      fail('Resposta não é PDF'); return false
    }
    pass(`PDF gerado ${buf2.length} bytes (FICHA_IDENTIFICACAO)`)

    info('5. GET /api/pdf/[actionId]/CERTIFICADO_CONCLUSAO')
    const r3 = await fetch(`${BASE_URL}/api/pdf/${actionId}/CERTIFICADO_CONCLUSAO`, {
      headers: { cookie: cookieHeader },
    })
    if (r3.status !== 200) { fail(`HTTP ${r3.status}`); return false }
    const buf3 = Buffer.from(await r3.arrayBuffer())
    if (!buf3.slice(0, 4).toString('ascii').startsWith('%PDF')) {
      fail('Resposta não é PDF'); return false
    }
    pass(`PDF gerado ${buf3.length} bytes (CERTIFICADO_CONCLUSAO)`)

    info('6. docType inválido → 400')
    const r4 = await fetch(`${BASE_URL}/api/pdf/${actionId}/INVALIDO`, {
      headers: { cookie: cookieHeader },
    })
    if (r4.status !== 400) { fail(`Esperava 400, recebeu ${r4.status}`); return false }
    pass('docType inválido → HTTP 400')

    info('7. Sem login → 401')
    const r5 = await fetch(`${BASE_URL}/api/pdf/${actionId}/REGISTO_PRESENCAS`)
    if (r5.status !== 401) { fail(`Esperava 401, recebeu ${r5.status}`); return false }
    pass('Sem auth → HTTP 401')

    info('8. TRAINEE → 403 (não é admin nem trainer da ação)')
    const traineeCookies = await getCookieHeader('maryluz@decathlon.com', 'Trainee123!')
    const r6 = await fetch(`${BASE_URL}/api/pdf/${actionId}/REGISTO_PRESENCAS`, {
      headers: { cookie: traineeCookies },
    })
    if (r6.status !== 403) { fail(`Esperava 403, recebeu ${r6.status}`); return false }
    pass('TRAINEE → HTTP 403')

    info('9. TRAINER da ação → 200')
    const trainerCookies = await getCookieHeader('trainer.test@oportoforte.com', 'Trainer123!')
    const r7 = await fetch(`${BASE_URL}/api/pdf/${actionId}/REGISTO_PRESENCAS`, {
      headers: { cookie: trainerCookies },
    })
    if (r7.status !== 200) { fail(`Esperava 200, recebeu ${r7.status}`); return false }
    pass('TRAINER atribuído → HTTP 200')

    return true
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTask032().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-032 PASSOU' : '❌ TASK-032 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
