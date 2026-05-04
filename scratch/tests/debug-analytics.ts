import { launchBrowser, loginAs, BASE_URL, prisma } from './harness'
async function main() {
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(() => {})
  const b = await launchBrowser(); const p = await b.newPage()
  await loginAs(p, 'admin@oportoforte.com', 'Admin123!')
  const cookies = await p.cookies()
  const ch = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  await b.close()
  const r = await fetch(`${BASE_URL}/api/admin/analytics/satisfaction`, { headers: { cookie: ch } })
  console.log('HTTP:', r.status)
  console.log(await r.text())
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
