import {
  prisma, BASE_URL, launchBrowser,
  ensureTenant, ensureAdminUser,
  header, pass, fail, info,
} from './harness'
import { CourseStatus, TrainingFormat } from '@prisma/client'

const TECHPORT_COURSE_NAME = 'Curso Exclusivo TechPort'
const TECHPORT_COURSE_SLUG = 'curso-exclusivo-techport'

export async function runTest2(): Promise<boolean> {
  header('TESTE-002 — Isolamento multi-tenant')
  let browser
  try {
    info('1. Criar Tenant "techport" + admin')
    const techport = await ensureTenant('techport', 'TechPort Formação')
    await ensureAdminUser({
      email: 'techport@test.com', password: 'Admin123!',
      firstName: 'Admin', lastName: 'TechPort', tenantId: techport.id,
    })
    pass(`Tenant techport id=${techport.id.slice(0, 8)}`)

    info('2. Criar 1 curso PUBLISHED no tenant techport')
    const course = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: techport.id, slug: TECHPORT_COURSE_SLUG } },
      update: { status: CourseStatus.PUBLISHED, name: TECHPORT_COURSE_NAME },
      create: {
        tenantId: techport.id,
        name: TECHPORT_COURSE_NAME,
        slug: TECHPORT_COURSE_SLUG,
        durationHours: 12,
        format: TrainingFormat.ELEARNING,
        status: CourseStatus.PUBLISHED,
        shortDescription: 'Curso exclusivamente da TechPort.',
      },
    })
    pass(`Curso criado: ${course.name}`)

    info('3. Verificar isolamento ao nível BD: query a oportoforte NÃO devolve curso techport')
    const oportoforteTenant = await prisma.tenant.findUnique({ where: { slug: 'oportoforte' } })
    if (!oportoforteTenant) {
      fail('Tenant oportoforte não existe')
      return false
    }
    const oporto_courses = await prisma.course.findMany({
      where: { tenantId: oportoforteTenant.id, status: { in: ['PUBLISHED', 'FEATURED'] } },
    })
    const found_in_oporto = oporto_courses.find(c => c.id === course.id)
    if (found_in_oporto) {
      fail('Curso techport encontrado no listing do tenant oportoforte (ISOLAMENTO QUEBRADO)')
      return false
    }
    pass(`Listagem oportoforte: ${oporto_courses.length} cursos, nenhum do techport`)

    info('4. Browser: visitar /techport/catalog (sem login)')
    browser = await launchBrowser()
    const page = await browser.newPage()
    const respTechport = await page.goto(`${BASE_URL}/techport/catalog`, { waitUntil: 'networkidle2' })
    if (respTechport?.status() !== 200) {
      fail(`/techport/catalog retornou HTTP ${respTechport?.status()}`)
      return false
    }
    const techportText = await page.$eval('body', el => el.innerText)
    if (!techportText.includes(TECHPORT_COURSE_NAME)) {
      fail(`Curso techport NÃO apareceu em /techport/catalog`)
      info('Snippet:\n' + techportText.slice(0, 800))
      return false
    }
    pass(`/techport/catalog mostra "${TECHPORT_COURSE_NAME}"`)

    info('5. Browser: visitar /oportoforte/catalog')
    const respOporto = await page.goto(`${BASE_URL}/oportoforte/catalog`, { waitUntil: 'networkidle2' })
    if (respOporto?.status() !== 200) {
      fail(`/oportoforte/catalog retornou HTTP ${respOporto?.status()}`)
      return false
    }
    const oportoText = await page.$eval('body', el => el.innerText)
    if (oportoText.includes(TECHPORT_COURSE_NAME)) {
      fail(`Curso techport APAREÇU em /oportoforte/catalog (ISOLAMENTO UI QUEBRADO)`)
      return false
    }
    pass(`/oportoforte/catalog NÃO mostra curso da techport`)

    // Confirmar que /oportoforte/catalog tem cursos próprios (não está vazia por outra razão)
    const oporto_count_in_page = oporto_courses.filter(c =>
      oportoText.includes(c.name)
    ).length
    info(`Cursos do oportoforte visíveis na página: ${oporto_count_in_page}/${oporto_courses.length}`)

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
  runTest2().then(ok => {
    console.log('\n' + (ok ? '✅ TESTE-002 PASSOU' : '❌ TESTE-002 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
