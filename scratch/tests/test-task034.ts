import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureTrainer, ensureUserAndTrainee,
  enrollTrainee,
  header, pass, fail, info,
} from './harness'
import { renderFichaIdentificacao } from '@/templates/pdf/FichaIdentificacao'
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

export async function runTask034(): Promise<boolean> {
  header('TASK-034 — Template Ficha de Identificação')
  try {
    info('1. Setup: tenant, admin, ClientOrg Decathlon, trainee com dados completos + GDPR + assinatura')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    let decathlon = await prisma.clientOrg.findFirst({ where: { tenantId: tenant.id, name: 'Decathlon' } })
    if (!decathlon) decathlon = await prisma.clientOrg.create({ data: { tenantId: tenant.id, name: 'Decathlon', country: 'PT' } })
    const trainer = await ensureTrainer(tenant.id)

    const course = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'task034-curso' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Inteligência Emocional', slug: 'task034-curso',
                durationHours: 24, format: TrainingFormat.PRESENCIAL, status: CourseStatus.PUBLISHED,
                code: 'IE-001' },
    })
    const action = await prisma.trainingAction.create({
      data: { tenantId: tenant.id, courseId: course.id, clientOrgId: decathlon.id,
              startDate: new Date('2026-04-15'), endDate: new Date('2026-04-22'),
              format: TrainingFormat.PRESENCIAL, status: TrainingStatus.IN_PROGRESS, actionCode: 'DEC-IE-2026' },
    })
    await prisma.trainingActionTrainer.create({ data: { trainingActionId: action.id, trainerId: trainer.id, role: 'MAIN' } })

    // Trainee Maryluz com TODOS os campos preenchidos
    const t = (await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })).trainee
    await prisma.trainee.update({
      where: { id: t.id },
      data: {
        nif: '123456789',
        ssn: '11122233344',
        idNumber: '12345678',
        idValidUntil: new Date('2030-12-31'),
        birthDate: new Date('1992-05-14'),
        nationality: 'Portuguesa',
        address: 'Rua Test 123',
        postalCode: '4000-001',
        city: 'Porto',
        phone: '+351 912345678',
        jobTitle: 'Vendedora',
        educationLevel: '12º ano',
        gdprConsent: true,
        gdprConsentAt: new Date('2026-04-01'),
        clientOrgId: decathlon.id,
      },
    })
    await enrollTrainee(action.id, t.id)

    // DocumentSignature FICHA_IDENTIFICACAO SIGNED
    const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII='
    await prisma.documentSignature.deleteMany({ where: { traineeId: t.id, documentType: DocumentType.FICHA_IDENTIFICACAO } })
    await prisma.documentSignature.create({
      data: { traineeId: t.id, documentType: DocumentType.FICHA_IDENTIFICACAO,
              status: SignatureStatus.SIGNED, signatureUrl: png1x1,
              enabledAt: new Date(), signedAt: new Date(), ipAddress: '::1' },
    })
    pass(`Setup OK — actionId=${action.id.slice(0,8)} trainee=${t.id.slice(0,8)}`)

    info('2. Render direto do template')
    const html = renderFichaIdentificacao({
      action: { ...action, course: { ...course, area: { name: 'Desenvolvimento Pessoal' } }, clientOrg: decathlon, room: null,
                trainers: [{ trainer: { user: { firstName: 'Trainer', lastName: 'Test' } } }],
                sessions: [] },
      tenant,
      trainees: [{
        id: t.id, firstName: 'Maryluz', lastName: 'Decathlon',
        nif: '123456789', ssn: '11122233344', idNumber: '12345678',
        idValidUntil: new Date('2030-12-31'), birthDate: new Date('1992-05-14'),
        nationality: 'Portuguesa', address: 'Rua Test 123', postalCode: '4000-001', city: 'Porto',
        email: 'maryluz@decathlon.com', phone: '+351 912345678',
        jobTitle: 'Vendedora', educationLevel: '12º ano',
        gdprConsent: true, gdprConsentAt: new Date('2026-04-01'),
        signatures: [{ documentType: 'FICHA_IDENTIFICACAO', status: 'SIGNED', signatureUrl: png1x1 }],
        checkIns: [],
      }],
      logos: { tenant: null, client: null, dgert: null },
    } as any, t.id)

    let allOk = true
    const checks: [string, RegExp | string][] = [
      ['Título', /FICHA DE IDENTIFICAÇÃO/i],
      ['Nome', 'Maryluz Decathlon'],
      ['Data nascimento (dd/mm/yyyy)', '14/05/1992'],
      ['Nacionalidade', 'Portuguesa'],
      ['Nº BI/CC', '12345678'],
      ['Validade BI', '31/12/2030'],
      ['NIF', '123456789'],
      ['NSS', '11122233344'],
      ['Morada', 'Rua Test 123'],
      ['Código Postal', '4000-001'],
      ['Localidade', 'Porto'],
      ['Email', 'maryluz@decathlon.com'],
      ['Telefone', '+351 912345678'],
      ['Profissão', 'Vendedora'],
      ['Habilitações', '12º ano'],
      ['Curso', 'Inteligência Emocional'],
      ['Código curso', 'IE-001'],
      ['Área DGERT', 'Desenvolvimento Pessoal'],
      ['Duração', '24 h'],
      ['Modalidade', 'PRESENCIAL'],
      ['Datas', /15\/04\/2026.*22\/04\/2026/s],
      ['RGPD texto', 'Regulamento Geral'],
      ['Checkbox marcado', 'class="checkbox checked"'],
      ['Assinatura formando img', png1x1.slice(0, 60)],
    ]
    for (const [label, expected] of checks) {
      const ok = expected instanceof RegExp ? expected.test(html) : html.includes(expected)
      if (ok) pass(`  ✓ ${label}`)
      else { fail(`  ✗ ${label} — não encontrado`); allOk = false }
    }
    if (!allOk) return false

    info('3. PDF via API')
    const cookieHeader = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const r = await fetch(`${BASE_URL}/api/pdf/${action.id}/FICHA_IDENTIFICACAO?traineeId=${t.id}`, { headers: { cookie: cookieHeader } })
    if (r.status !== 200) { fail(`HTTP ${r.status}: ${await r.text()}`); return false }
    const buf = Buffer.from(await r.arrayBuffer())
    if (!buf.slice(0, 4).toString('ascii').startsWith('%PDF')) { fail('Não é PDF'); return false }
    if (buf.length < 50000) { fail(`PDF demasiado pequeno (${buf.length}) — provavelmente stub ainda`); return false }
    pass(`PDF gerado: ${buf.length} bytes`)

    info('4. Trainee com gdprConsent=false → checkbox NÃO marcado')
    const html2 = renderFichaIdentificacao({
      action, tenant,
      trainees: [{ ...{ id: t.id, firstName: 'A', lastName: 'B', gdprConsent: false, signatures: [], checkIns: [] } }],
      logos: { tenant: null, client: null, dgert: null },
    } as any, t.id)
    if (html2.includes('class="checkbox checked"')) { fail('Checkbox marcado quando gdprConsent=false'); return false }
    pass('Checkbox desmarcado quando gdprConsent=false')

    return true
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTask034().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-034 PASSOU' : '❌ TASK-034 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
