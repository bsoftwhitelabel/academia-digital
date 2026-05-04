import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureTrainer, ensureUserAndTrainee,
  enrollTrainee,
  header, pass, fail, info,
} from './harness'
import { getLogosAsBase64, _clearLogoCache } from '@/lib/pdf-logos'
import { DocumentType, SignatureStatus, TrainingFormat, TrainingStatus, CourseStatus } from '@prisma/client'

const ADMIN_EMAIL = 'admin@oportoforte.com'

async function getCookieHeader(email: string, password: string) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

const PNG_GOLD = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAQAAAABBh0CGwAAACFJREFUeNrtwQEBAAAAgiD/r25IQAEAAAAAAAAAAAAAAAB4AcsKAAGsKuPLAAAAAElFTkSuQmCC'

export async function runTask036(): Promise<boolean> {
  header('TASK-036 — Logos por ClientOrg + teste integração')
  try {
    info('1. Setup: tenant + admin + ClientOrg Decathlon (com logo) + ação completa')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { logoUrl: PNG_GOLD, dgertLogoUrl: null }, // dgertLogoUrl null → cai no ficheiro local
    })
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    let decathlon = await prisma.clientOrg.findFirst({ where: { tenantId: tenant.id, name: 'Decathlon' } })
    if (!decathlon) decathlon = await prisma.clientOrg.create({ data: { tenantId: tenant.id, name: 'Decathlon', country: 'PT' } })
    const decaLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAA1BMVEUyZvBjWEHTAAAAFklEQVR42mNgGAWjYBSMglEwCkbBcAAACEgAAUOq/zUAAAAASUVORK5CYII='
    await prisma.clientOrg.update({ where: { id: decathlon.id }, data: { logoUrl: decaLogo } })

    const trainer = await ensureTrainer(tenant.id)
    const course = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'task036-curso' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Atendimento de Excelência', slug: 'task036-curso',
                durationHours: 30, format: TrainingFormat.PRESENCIAL, status: CourseStatus.PUBLISHED,
                code: 'AE-001' },
    })
    const action = await prisma.trainingAction.create({
      data: { tenantId: tenant.id, courseId: course.id, clientOrgId: decathlon.id,
              startDate: new Date('2026-04-01'), endDate: new Date('2026-04-25'),
              format: TrainingFormat.PRESENCIAL, status: TrainingStatus.IN_PROGRESS,
              actionCode: 'DEC-AE-2026' },
    })
    await prisma.trainingActionTrainer.create({ data: { trainingActionId: action.id, trainerId: trainer.id, role: 'MAIN' } })

    const session = await prisma.trainingSession.create({
      data: { trainingActionId: action.id, trainerId: trainer.id,
              sessionDate: new Date('2026-04-15'), startTime: '09:00', endTime: '17:00',
              durationHours: 8, isOpen: false, isClosed: true,
              closedAt: new Date('2026-04-15T17:00:00Z') },
    })

    const t = (await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })).trainee
    await prisma.trainee.update({
      where: { id: t.id },
      data: { nif: '123456789', clientOrgId: decathlon.id, gdprConsent: true,
              gdprConsentAt: new Date('2026-04-01'), birthDate: new Date('1992-05-14') },
    })
    await enrollTrainee(action.id, t.id)
    await prisma.checkIn.deleteMany({ where: { sessionId: session.id, traineeId: t.id } })
    await prisma.checkIn.create({ data: { sessionId: session.id, traineeId: t.id, status: 'CHECKED_IN' } })

    // Assinatura SIGNED de REGISTO_PRESENCAS
    const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII='
    await prisma.documentSignature.deleteMany({ where: { traineeId: t.id, documentType: DocumentType.REGISTO_PRESENCAS } })
    await prisma.documentSignature.create({
      data: { sessionId: session.id, traineeId: t.id, documentType: DocumentType.REGISTO_PRESENCAS,
              status: SignatureStatus.SIGNED, signatureUrl: png1x1, enabledAt: new Date(), signedAt: new Date(), ipAddress: '::1' },
    })
    pass(`Setup OK — actionId=${action.id.slice(0,8)} trainee=${t.id.slice(0,8)}`)

    info('2. Unit test: getLogosAsBase64 devolve os 3 logos como data URL')
    _clearLogoCache()
    const logos = await getLogosAsBase64(tenant.id, decathlon.id)
    if (!logos.tenant?.startsWith('data:image/')) { fail(`tenant logo: ${String(logos.tenant).slice(0,40)}`); return false }
    if (!logos.client?.startsWith('data:image/')) { fail(`client logo: ${String(logos.client).slice(0,40)}`); return false }
    if (!logos.dgert?.startsWith('data:image/png;base64,')) { fail(`dgert (deveria vir do ficheiro local): ${String(logos.dgert).slice(0,40)}`); return false }
    pass(`Logos: tenant=${logos.tenant.length}B client=${logos.client.length}B dgert=${logos.dgert.length}B`)

    info('3. Cache: 2ª chamada devolve mesmas instâncias')
    const t1 = Date.now()
    const cached = await getLogosAsBase64(tenant.id, decathlon.id)
    const dt = Date.now() - t1
    if (cached.tenant !== logos.tenant) { fail('Tenant logo não veio do cache'); return false }
    if (dt > 50) info(`  (cache hit em ${dt}ms — esperado <50)`)
    pass(`Cache hit: ${dt}ms`)

    info('4. clientOrgId null → client=null mas tenant/dgert presentes')
    _clearLogoCache()
    const noClient = await getLogosAsBase64(tenant.id, null)
    if (noClient.client !== null) { fail(`client devia ser null, é ${String(noClient.client).slice(0,40)}`); return false }
    if (!noClient.tenant) { fail('tenant logo perdido'); return false }
    if (!noClient.dgert) { fail('dgert logo perdido'); return false }
    pass('Sem clientOrg → tenant+dgert OK, client=null')

    info('5. URL externa que falha → null (não rebenta)')
    _clearLogoCache()
    await prisma.clientOrg.update({ where: { id: decathlon.id }, data: { logoUrl: 'http://nope.example.invalid/logo.png' } })
    const failed = await getLogosAsBase64(tenant.id, decathlon.id)
    if (failed.client !== null) { fail(`URL inválida deveria devolver null, é ${String(failed.client).slice(0,40)}`); return false }
    pass('URL inválida → client=null (não falha)')
    // Repor decathlon logo
    await prisma.clientOrg.update({ where: { id: decathlon.id }, data: { logoUrl: decaLogo } })
    _clearLogoCache()

    info('6. Integração: GET /api/pdf/[actionId]/REGISTO_PRESENCAS')
    const cookieHeader = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const r1 = await fetch(`${BASE_URL}/api/pdf/${action.id}/REGISTO_PRESENCAS`, { headers: { cookie: cookieHeader } })
    if (r1.status !== 200) { fail(`HTTP ${r1.status}: ${await r1.text()}`); return false }
    const buf1 = Buffer.from(await r1.arrayBuffer())
    if (!buf1.slice(0, 4).toString('ascii').startsWith('%PDF')) { fail('Não é PDF'); return false }
    pass(`Folha de Presenças PDF: ${buf1.length} bytes`)

    info('7. Integração: GET /api/pdf/[actionId]/CERTIFICADO_CONCLUSAO')
    const r2 = await fetch(`${BASE_URL}/api/pdf/${action.id}/CERTIFICADO_CONCLUSAO?traineeId=${t.id}`, { headers: { cookie: cookieHeader } })
    if (r2.status !== 200) { fail(`HTTP ${r2.status}: ${await r2.text()}`); return false }
    const buf2 = Buffer.from(await r2.arrayBuffer())
    if (!buf2.slice(0, 4).toString('ascii').startsWith('%PDF')) { fail('Não é PDF'); return false }
    pass(`Certificado PDF: ${buf2.length} bytes`)

    info('8. Integração: GET /api/pdf/[actionId]/FICHA_IDENTIFICACAO')
    const r3 = await fetch(`${BASE_URL}/api/pdf/${action.id}/FICHA_IDENTIFICACAO?traineeId=${t.id}`, { headers: { cookie: cookieHeader } })
    if (r3.status !== 200) { fail(`HTTP ${r3.status}`); return false }
    const buf3 = Buffer.from(await r3.arrayBuffer())
    if (!buf3.slice(0, 4).toString('ascii').startsWith('%PDF')) { fail('Não é PDF'); return false }
    pass(`Ficha Identificação PDF: ${buf3.length} bytes`)

    info('9. Smoke: garantir que o PDF da Folha contém embeds de imagem')
    // Procurar marcadores de imagem em PDFs
    const pdfStr = buf1.toString('latin1')
    const imgMatches = (pdfStr.match(/\/Image/g) || []).length
    if (imgMatches < 2) { fail(`Esperava ≥2 imagens no PDF (logos), encontrei ${imgMatches}`); return false }
    pass(`PDF contém ${imgMatches} referências a /Image (logos + assinatura)`)

    info('10. Resumo da Fase 1.6: PDFs com branding completos')
    info(`  • Folha de Presenças: ${buf1.length} bytes`)
    info(`  • Ficha Identificação: ${buf3.length} bytes`)
    info(`  • Certificado: ${buf2.length} bytes`)

    return true
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTask036().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-036 PASSOU' : '❌ TASK-036 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
