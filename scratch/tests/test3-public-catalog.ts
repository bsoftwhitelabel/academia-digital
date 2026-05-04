import {
  prisma, BASE_URL, launchBrowser,
  header, pass, fail, info,
} from './harness'

const SEED_COURSES = [
  'Liderança e Gestão de Equipas',
  'Comunicação Assertiva',
  'Gestão de Tempo e Produtividade',
  'Inteligência Emocional',
  'Atendimento de Excelência',
]

export async function runTest3(): Promise<boolean> {
  header('TESTE-003 — Catálogo sem autenticação')
  let browser
  try {
    info('1. Abrir browser sem cookies (incognito)')
    browser = await launchBrowser()
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()

    info('2. Visitar /oportoforte/catalog')
    const resp = await page.goto(`${BASE_URL}/oportoforte/catalog`, { waitUntil: 'networkidle2' })
    if (resp?.status() !== 200) {
      fail(`HTTP ${resp?.status()} (esperava 200 sem login)`)
      return false
    }
    pass('Catálogo carregou sem login (HTTP 200)')

    info('3. Verificar 5 cursos seed presentes')
    const txt = await page.$eval('body', el => el.innerText)
    let allPresent = true
    for (const name of SEED_COURSES) {
      if (txt.includes(name)) {
        pass(`  ✓ "${name}"`)
      } else {
        fail(`  ✗ Curso seed não encontrado: "${name}"`)
        allPresent = false
      }
    }
    if (!allPresent) return false

    info('4. Verificar layout em grid')
    const gridFound = await page.evaluate(() => {
      const elems = Array.from(document.querySelectorAll('*'))
      return elems.some(el => /grid-cols-/.test((el as HTMLElement).className || ''))
    })
    if (!gridFound) { fail('Nenhum elemento com grid-cols-'); return false }
    pass('Layout em grid (Tailwind grid-cols-*)')

    info('5. Clicar num curso → ficha individual')
    // Find course card link
    const courseSlug = 'lideranca-gestao'
    const link = await page.$(`a[href="/oportoforte/catalog/${courseSlug}"]`)
    if (!link) {
      fail(`Link do curso ${courseSlug} não encontrado no catálogo`)
      return false
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null),
      link.click(),
    ])
    if (!page.url().includes(`/catalog/${courseSlug}`)) {
      // fallback: navigate directly
      await page.goto(`${BASE_URL}/oportoforte/catalog/${courseSlug}`, { waitUntil: 'networkidle2' })
    }
    const fichaText = await page.$eval('body', el => el.innerText)
    if (!fichaText.includes('Liderança e Gestão de Equipas')) {
      fail('Ficha do curso não mostra o nome correto')
      return false
    }
    pass('Ficha individual carregou')

    info('6. Clicar "Tenho Interesse"')
    const buttons = await page.$$('button')
    let opened = false
    for (const b of buttons) {
      const t = await page.evaluate(el => el.textContent, b)
      if (t?.includes('Tenho Interesse')) {
        await b.click()
        opened = true
        break
      }
    }
    if (!opened) { fail('Botão "Tenho Interesse" não encontrado'); return false }
    await new Promise(r => setTimeout(r, 600))

    info('7. Preencher formulário')
    // Wait for dialog inputs
    await page.waitForSelector('input[name="firstName"]', { timeout: 5000 })
    const uniqueEmail = `prospect.${Date.now()}@test.com`
    await page.type('input[name="firstName"]', 'Joana')
    await page.type('input[name="lastName"]', 'Prospect')
    await page.type('input[name="email"]', uniqueEmail)
    await page.type('input[name="company"]', 'Empresa Teste')
    await page.type('input[name="message"]', 'Tenho interesse no curso')

    info('8. Submeter')
    const submitButtons = await page.$$('button[type="submit"]')
    if (submitButtons.length === 0) { fail('Botão submit não encontrado'); return false }
    await submitButtons[0].click()
    await new Promise(r => setTimeout(r, 2500))

    const afterTxt = await page.$eval('body', el => el.innerText)
    if (!afterTxt.includes('Pedido enviado com sucesso')) {
      fail('Confirmação "Pedido enviado com sucesso" não apareceu')
      info('Snippet:\n' + afterTxt.slice(0, 600))
      return false
    }
    pass('UI confirma "Pedido enviado com sucesso"')

    info('9. Verificar Inquiry na BD')
    const inquiry = await prisma.inquiry.findFirst({
      where: { email: uniqueEmail },
      orderBy: { createdAt: 'desc' },
    })
    if (!inquiry) {
      fail(`Nenhum Inquiry encontrado para email ${uniqueEmail}`)
      return false
    }
    pass(`Inquiry criado: id=${inquiry.id.slice(0,8)} email=${inquiry.email} curso="${inquiry.courseName}" status=${inquiry.status}`)

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
  runTest3().then(ok => {
    console.log('\n' + (ok ? '✅ TESTE-003 PASSOU' : '❌ TESTE-003 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
