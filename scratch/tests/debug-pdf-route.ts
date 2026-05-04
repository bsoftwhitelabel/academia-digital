import { launchBrowser, loginAs, BASE_URL, prisma } from './harness'

async function main() {
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(() => {})
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await loginAs(page, 'admin@oportoforte.com', 'Admin123!')
  const cookies = await page.cookies()
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  await browser.close()

  const sht = await prisma.course.findFirst({ where: { name: 'Segurança e Higiene no Trabalho' } })
  const action = await prisma.trainingAction.findFirst({ where: { courseId: sht!.id }, orderBy: { createdAt: 'desc' } })
  console.log('actionId:', action!.id)

  const r = await fetch(`${BASE_URL}/api/pdf/${action!.id}/CAPA`, { headers: { cookie: cookieHeader } })
  console.log('HTTP:', r.status)
  const ct = r.headers.get('content-type')
  console.log('Content-Type:', ct)
  if (ct?.includes('json')) {
    console.log('Body:', await r.text())
  } else {
    const buf = Buffer.from(await r.arrayBuffer())
    console.log('Bytes:', buf.length, 'starts with:', buf.slice(0, 8).toString('hex'))
  }
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
