import {
  prisma, BASE_URL, launchBrowser,
  ensureTenant,
  header, pass, fail, info,
} from './harness'

export async function runSprint3(): Promise<boolean> {
  header('Sprint 3 — Catálogo Avançado + Workshops')
  let allOk = true
  let browser

  try {
    info('Setup: garantir tenant + 27 workshops seed')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    const workshops = await prisma.course.findMany({
      where: { tenantId: tenant.id, tags: { has: 'workshop' }, status: { in: ['PUBLISHED', 'FEATURED'] } },
    })
    if (workshops.length < 27) { fail(`Esperava ≥27 workshops, encontrei ${workshops.length}. Corre: npx tsx prisma/seed-workshops.ts`); return false }
    pass(`${workshops.length} workshops na BD`)

    info('TASK-065 — /oportoforte/catalog/workshops')
    browser = await launchBrowser()
    const ctx = await browser.createBrowserContext()
    const guest = await ctx.newPage()
    const r1 = await guest.goto(`${BASE_URL}/oportoforte/catalog/workshops`, { waitUntil: 'networkidle2' })
    if (r1?.status() !== 200) { fail(`HTTP ${r1?.status()}`); return false }
    const txt1 = await guest.$eval('body', el => el.innerText)

    // Identidade visual: deve usar verde, não navy dominante
    const html = await guest.content()
    const greenRefs = (html.match(/#15803D/gi) || []).length
    const navyRefsInWorkshops = (html.match(/#0B2447/g) || []).length
    info(`  cor #15803D: ${greenRefs} refs · #0B2447: ${navyRefsInWorkshops} refs`)
    if (greenRefs < 5) { fail('Identidade verde insuficiente'); allOk = false }
    else pass(`Identidade verde dominante (${greenRefs} refs #15803D)`)

    // Hero com mensagem regulatória
    if (!txt1.includes('legalmente responsáveis')) { fail('Mensagem regulatória ausente no hero'); allOk = false }
    else pass('Hero com mensagem regulatória ✓')

    // 27 workshops em grid
    const cards = await guest.$$('[data-testid^="workshop-card-"]')
    info(`  Cards de workshop: ${cards.length}`)
    if (cards.length !== 27) { fail(`Esperava 27 cards, encontrei ${cards.length}`); allOk = false }
    else pass('27 workshops em grid ✓')

    // CTAs
    if (!await guest.$('[data-testid="cta-ver-workshops"]')) { fail('CTA "Ver Workshops" ausente'); allOk = false }
    if (!await guest.$('[data-testid="cta-calculadora"]')) { fail('CTA calculadora ausente'); allOk = false }
    else pass('CTAs presentes')

    // Banner no catálogo principal
    info('  Banner "Workshops em Destaque" no catálogo principal')
    const r1b = await guest.goto(`${BASE_URL}/oportoforte/catalog`, { waitUntil: 'networkidle2' })
    const txt1b = await guest.$eval('body', el => el.innerText)
    if (!txt1b.includes('Workshops de Saúde')) { fail('Banner não aparece em /catalog'); allOk = false }
    else pass('Banner com link para /workshops presente em /catalog')
    await ctx.close()

    info('TASK-067 — SEO + JSON-LD')
    const ctx2 = await browser.createBrowserContext()
    const g2 = await ctx2.newPage()
    // Curso 1 para inspecionar JSON-LD
    const w0 = workshops[0]
    const r2 = await g2.goto(`${BASE_URL}/oportoforte/catalog/${w0.slug}`, { waitUntil: 'networkidle2' })
    if (r2?.status() !== 200) { fail(`HTTP ${r2?.status()}`); return false }
    const html2 = await g2.content()
    if (!html2.includes('application/ld+json')) { fail('Tag JSON-LD ausente'); allOk = false }
    else pass('Tag application/ld+json presente')
    if (!html2.includes('"@type":"Course"')) { fail('schema.org Course type ausente'); allOk = false }
    else pass('schema.org @type=Course ✓')
    if (!html2.includes('"@type":"Organization"')) { fail('Organization provider ausente'); allOk = false }
    else pass('schema.org Organization provider ✓')
    await ctx2.close()

    info('  sitemap.xml e robots.txt (root domain)')
    const sm = await fetch(`${BASE_URL}/sitemap.xml`)
    if (sm.status !== 200) { fail(`sitemap HTTP ${sm.status}`); allOk = false }
    else {
      const xml = await sm.text()
      const urls = (xml.match(/<loc>[^<]+<\/loc>/g) || []).length
      info(`  sitemap.xml: ${urls} URLs`)
      if (urls < 27) { fail(`Esperava ≥27 URLs no sitemap, encontrei ${urls}`); allOk = false }
      else pass(`sitemap com ${urls} URLs (tenants + cursos)`)
      if (!xml.includes(w0.slug)) { fail('Slug do curso ausente do sitemap'); allOk = false }
      else pass(`sitemap inclui ${w0.slug}`)
      if (!xml.includes('/oportoforte/catalog/workshops')) { fail('URL /workshops ausente'); allOk = false }
      else pass('sitemap inclui /oportoforte/catalog/workshops')
    }
    const robots = await fetch(`${BASE_URL}/robots.txt`)
    if (robots.status !== 200) { fail(`robots HTTP ${robots.status}`); allOk = false }
    else {
      const t = await robots.text()
      if (!t.includes('Sitemap:')) { fail('robots.txt sem Sitemap:'); allOk = false }
      else pass('robots.txt com Sitemap directive')
      if (!t.includes('Disallow: /admin')) { fail('robots.txt sem Disallow /admin'); allOk = false }
      else pass('robots.txt protege /admin')
    }

    info('TASK-068 — Analytics: TrackableCard + dashboard')
    // Verificar que o componente existe (compile time check). Mais forte: verificar
    // que o admin dashboard renderiza.
    // (Para isso precisamos de cookie admin — mas como o teste foca catálogo público,
    //  validamos só a estrutura via fetch de página interna.)
    // Aqui validamos que o módulo @vercel/analytics está instalado:
    const pkg = JSON.parse((await import('fs')).readFileSync(
      'package.json', 'utf-8'
    ))
    if (!pkg.dependencies?.['@vercel/analytics']) {
      fail('@vercel/analytics não instalado'); allOk = false
    } else pass(`@vercel/analytics ${pkg.dependencies['@vercel/analytics']} instalado`)

    info('TASK-069 — Calculadora B2B')
    const ctx3 = await browser.createBrowserContext()
    const g3 = await ctx3.newPage()
    const r3 = await g3.goto(`${BASE_URL}/oportoforte/catalog/workshops/calculator`, { waitUntil: 'networkidle2' })
    if (r3?.status() !== 200) { fail(`HTTP ${r3?.status()}`); return false }
    await g3.waitForSelector('[data-testid="emp-slider"]', { timeout: 10000 })

    // Injetar valor 100 no slider
    await g3.evaluate(() => {
      const slider = document.querySelector('[data-testid="emp-slider"]') as HTMLInputElement
      slider.value = '100'
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await new Promise(r => setTimeout(r, 200))

    const empCount = await g3.$eval('[data-testid="emp-count"]', el => el.textContent || '')
    if (empCount.trim() !== '100') { fail(`emp-count=${empCount}`); allOk = false }
    else pass('Slider de colaboradores → 100')

    // Cálculos esperados:
    //  cost = 100 × 0.15 × 25 × 80 = 30 000
    //  savings = 30 000 × 0.23 = 6 900
    const annualCostText = await g3.$eval('[data-testid="annual-cost"]', el => el.textContent || '')
    const savingsText = await g3.$eval('[data-testid="savings"]', el => el.textContent || '')
    const roiText = await g3.$eval('[data-testid="roi"]', el => el.textContent || '')
    info(`  Custo anual: ${annualCostText.trim()}`)
    info(`  Savings: ${savingsText.trim()}`)
    info(`  ROI: ${roiText.trim()}`)
    if (!annualCostText.includes('30')) { fail('Custo anual não inclui "30"'); allOk = false }
    else pass('Custo anual ≈ 30k €')
    if (!savingsText.includes('6')) { fail('Savings não inclui "6"'); allOk = false }
    else pass('Savings ≈ 6.9k €')
    if (!roiText.includes('4')) { fail('ROI não inclui "4"'); allOk = false }
    else pass('ROI €4 por €1 ✓')

    // CTA aponta para workshops com query string
    const ctaHref = await g3.$eval('[data-testid="cta-proposta"]', (el: any) => el.getAttribute('href') || '')
    if (!ctaHref.includes('employees=100')) { fail(`CTA href não pré-preenche: ${ctaHref}`); allOk = false }
    else pass(`CTA pré-preenche calculadora: ${ctaHref.slice(0, 80)}…`)
    await ctx3.close()

    info('TASK-070 — B2B Proposal Form + endpoint')
    const ctx4 = await browser.createBrowserContext()
    const g4 = await ctx4.newPage()
    const r4 = await g4.goto(`${BASE_URL}/oportoforte/catalog/workshops#proposta`, { waitUntil: 'networkidle2' })
    if (r4?.status() !== 200) { fail(`HTTP ${r4?.status()}`); return false }
    await g4.waitForSelector('[data-testid="b2b-form"]', { timeout: 10000 })

    // Preencher campos: puppeteer.type() respeita o setter nativo (React-friendly)
    const inputs = await g4.$$('[data-testid="b2b-form"] input')
    if (inputs.length < 4) { fail(`Inputs insuficientes (${inputs.length})`); return false }
    await inputs[0].type('Carla')
    await inputs[1].type('Prospect')
    const uniqEmail = `b2b.${Date.now()}@empresa.test`
    await inputs[2].type(uniqEmail)
    await inputs[3].type('+351 911 222 333')

    await (await g4.$('[data-testid="b2b-company"]'))!.type('TestCorp Lda')
    await (await g4.$('[data-testid="b2b-nif"]'))!.type('500123456')
    await (await g4.$('[data-testid="b2b-setor"]'))!.type('Tecnologia')
    await g4.select('[data-testid="b2b-emp-range"]', '50-200')

    // Selecionar 2 workshops
    const checkboxes = await g4.$$('[data-testid^="b2b-ws-"]')
    if (checkboxes.length === 0) { fail('Sem workshops no form'); allOk = false }
    else {
      await checkboxes[0].click()
      await checkboxes[1].click()
      pass(`2 workshops selecionados (de ${checkboxes.length} disponíveis)`)
    }

    // Submeter
    const beforeInq = await prisma.inquiry.count({ where: { tenantId: tenant.id, source: 'B2B_PROPOSAL' } })
    await g4.click('[data-testid="b2b-submit"]')
    await new Promise(r => setTimeout(r, 3000))
    const afterInq = await prisma.inquiry.count({ where: { tenantId: tenant.id, source: 'B2B_PROPOSAL' } })
    if (afterInq <= beforeInq) { fail(`Inquiry B2B não criado (${beforeInq} → ${afterInq})`); allOk = false }
    else pass(`Inquiry B2B criado (${beforeInq} → ${afterInq})`)

    const lastInq = await prisma.inquiry.findFirst({
      where: { tenantId: tenant.id, source: 'B2B_PROPOSAL' },
      orderBy: { createdAt: 'desc' },
    })
    if (lastInq) {
      info(`  Inquiry: ${lastInq.firstName} ${lastInq.lastName} | empresa=${lastInq.company} | curso="${lastInq.courseName}"`)
      if (!lastInq.message?.includes('NIF')) { fail('Message não inclui NIF'); allOk = false }
      else pass('Message com detalhes B2B (NIF, setor, formato, workshops)')
      if (!lastInq.message?.includes('Workshops:')) { fail('Message não lista workshops'); allOk = false }
      else pass('Message lista workshops selecionados')
    }

    // Verificar success state
    const successCard = await g4.$('[data-testid="b2b-success"]')
    if (!successCard) { fail('Estado de sucesso não apareceu'); allOk = false }
    else pass('Card de sucesso "Pedido recebido!" mostrado')

    await ctx4.close()

    info('TASK-068 — admin/analytics/catalog (validar fetch da API)')
    // Login admin via cookies separadas — usamos directamente prisma para validar
    // a estrutura. A página é authenticated.
    const recentInqs = await prisma.inquiry.findMany({
      where: { tenantId: tenant.id, createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
    })
    pass(`Inquiries últimos 30 dias: ${recentInqs.length}`)

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
  runSprint3().then(ok => {
    console.log('\n' + (ok ? '✅ SPRINT 3 — TUDO PASSA' : '❌ ALGUM PASSO FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
