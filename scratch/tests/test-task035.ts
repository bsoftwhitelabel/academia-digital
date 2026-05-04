import {
  prisma, BASE_URL, launchBrowser, loginAs,
  ensureTenant, ensureAdminUser, ensureTrainer, ensureUserAndTrainee,
  enrollTrainee,
  header, pass, fail, info,
} from './harness'
import { renderCertificado } from '@/templates/pdf/Certificado'
import { TrainingFormat, TrainingStatus, CourseStatus } from '@prisma/client'

const ADMIN_EMAIL = 'admin@oportoforte.com'

async function getCookieHeader(email: string, password: string) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, email, password)
  const cookies = await page.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

export async function runTask035(): Promise<boolean> {
  header('TASK-035 — Template Certificado de Conclusão')
  try {
    info('1. Setup: tenant + admin + curso + ação concluída + 1 formando')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    await ensureAdminUser({ email: ADMIN_EMAIL, password: 'Admin123!', firstName: 'Admin', lastName: 'Oporto', tenantId: tenant.id })
    const trainer = await ensureTrainer(tenant.id)
    let decathlon = await prisma.clientOrg.findFirst({ where: { tenantId: tenant.id, name: 'Decathlon' } })
    if (!decathlon) decathlon = await prisma.clientOrg.create({ data: { tenantId: tenant.id, name: 'Decathlon', country: 'PT' } })

    const course = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'task035-curso' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Liderança e Gestão de Equipas', slug: 'task035-curso',
                durationHours: 40, format: TrainingFormat.PRESENCIAL, status: CourseStatus.PUBLISHED },
    })
    const action = await prisma.trainingAction.create({
      data: { tenantId: tenant.id, courseId: course.id, clientOrgId: decathlon.id,
              startDate: new Date('2026-03-01'), endDate: new Date('2026-04-15'),
              format: TrainingFormat.PRESENCIAL, status: TrainingStatus.COMPLETED, actionCode: 'LID-2026' },
    })
    await prisma.trainingActionTrainer.create({ data: { trainingActionId: action.id, trainerId: trainer.id, role: 'MAIN' } })
    const t = (await ensureUserAndTrainee({
      email: 'maryluz@decathlon.com', password: 'Trainee123!',
      firstName: 'Maryluz', lastName: 'Decathlon', tenantId: tenant.id,
    })).trainee
    await enrollTrainee(action.id, t.id)
    pass(`Setup OK — actionId=${action.id.slice(0,8)}`)

    info('2. Render direto do template (sem QR — para testar fallback de placeholder)')
    const html0 = renderCertificado({
      trainee: { firstName: 'Maryluz', lastName: 'Decathlon' },
      course: { name: 'Liderança e Gestão de Equipas', durationHours: 40 },
      action: { startDate: new Date('2026-03-01'), endDate: new Date('2026-04-15'), room: { city: 'Porto' } },
      certificate: { verificationCode: 'TESTCODE-12345', issuedAt: new Date('2026-04-29') },
      tenant: { name: 'Grupo Oporto Forte' },
      logos: { tenant: null, client: null, dgert: null },
      qrDataUrl: null,
      verifyUrl: null,
    } as any)
    let allOk = true
    const checks: [string, RegExp | string][] = [
      ['Texto principal', /Certificado de Conclus[ãa]o/i],
      ['Lead', 'Certifica-se que'],
      ['Nome', 'Maryluz Decathlon'],
      ['Frase chave', 'concluiu com aproveitamento'],
      ['Curso', 'Liderança e Gestão de Equipas'],
      ['Duração', /40\s*horas/i],
      ['Datas', /01\/03\/2026.*15\/04\/2026/s],
      ['Local', 'Porto'],
      ['Verificar autenticidade', 'Verificar autenticidade'],
      ['Código de verificação', 'TESTCODE-12345'],
      ['Moldura navy', '#0B2447'],
      ['Layout A4 paisagem', 'A4 landscape'],
    ]
    for (const [label, expected] of checks) {
      const ok = expected instanceof RegExp ? expected.test(html0) : html0.includes(expected)
      if (ok) pass(`  ✓ ${label}`)
      else { fail(`  ✗ ${label} — não encontrado`); allOk = false }
    }
    if (!allOk) return false

    info('3. Render com QR data URL → <img> presente, sem placeholder')
    const fakeQr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII='
    const html1 = renderCertificado({
      trainee: { firstName: 'A', lastName: 'B' },
      course: { name: 'X', durationHours: 1 },
      action: { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-02') },
      certificate: { verificationCode: 'C', issuedAt: new Date() },
      tenant: { name: 'T' },
      logos: { tenant: null, client: null, dgert: null },
      qrDataUrl: fakeQr,
      verifyUrl: 'http://localhost:3000/verify/C',
    } as any)
    if (!html1.includes(fakeQr.slice(0, 50))) { fail('QR <img> não injetado'); return false }
    pass('QR injetado como <img src="data:image/png;...">')

    info('4. Gerar PDF via API')
    const cookieHeader = await getCookieHeader(ADMIN_EMAIL, 'Admin123!')
    const r = await fetch(`${BASE_URL}/api/pdf/${action.id}/CERTIFICADO_CONCLUSAO`, { headers: { cookie: cookieHeader } })
    if (r.status !== 200) { fail(`HTTP ${r.status}: ${await r.text()}`); return false }
    const buf = Buffer.from(await r.arrayBuffer())
    if (!buf.slice(0, 4).toString('ascii').startsWith('%PDF')) { fail('Não é PDF'); return false }
    if (buf.length < 50000) { fail(`PDF muito pequeno (${buf.length}) — provavelmente stub`); return false }
    pass(`PDF gerado: ${buf.length} bytes (com QR e moldura)`)

    info('5. Verificar formato A4 paisagem (PDF metadata)')
    // Procurar /MediaBox no PDF — paisagem: 842 x 595 (landscape)
    const pdfText = buf.toString('latin1')
    const mediaBoxMatch = pdfText.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)
    if (!mediaBoxMatch) { fail('MediaBox não encontrada no PDF'); return false }
    const w = parseFloat(mediaBoxMatch[1]), h = parseFloat(mediaBoxMatch[2])
    info(`  MediaBox: ${w} × ${h}`)
    if (w < h) { fail('PDF não está em paisagem (w < h)'); return false }
    pass('PDF está em A4 paisagem (w > h)')

    return true
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTask035().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-035 PASSOU' : '❌ TASK-035 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
