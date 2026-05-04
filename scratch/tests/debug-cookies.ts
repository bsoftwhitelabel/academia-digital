import { launchBrowser, loginAs, BASE_URL, prisma } from './harness'

async function main() {
  const b = await launchBrowser()
  const p = await b.newPage()
  await loginAs(p, 'admin@oportoforte.com', 'Admin123!')
  console.log('URL after login:', p.url())
  const cookies = await p.cookies()
  console.log('Cookies:', cookies.length, cookies.map(c => c.name).join(','))
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  const r = await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie: cookieHeader } })
  console.log('Auth /session:', r.status, (await r.text()).slice(0, 200))
  await b.close()
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
