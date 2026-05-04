import { launchBrowser, loginAs, BASE_URL, prisma } from './harness'
async function main() {
  await fetch(`${BASE_URL}/api/debug/reset-rate-limit`, { method: 'POST' }).catch(() => {})
  const b = await launchBrowser()
  const p = await b.newPage()
  await loginAs(p, 'maryluz@decathlon.com', 'Trainee123!')
  const cookies = await p.cookies()
  const ch = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  await b.close()
  const r = await fetch(`${BASE_URL}/api/trainee/profile/notifications`, {
    method: 'PUT', headers: { cookie: ch, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notifEmail: true, notifWhatsApp: false, phone: '+351 912 345 678' }),
  })
  console.log('HTTP:', r.status)
  console.log('Body:', await r.text())
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
