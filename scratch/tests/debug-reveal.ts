import { launchBrowser, loginAs, BASE_URL, prisma } from './harness'

async function main() {
  const b = await launchBrowser()
  const p = await b.newPage()
  await loginAs(p, 'admin@oportoforte.com', 'Admin123!')
  console.log('URL after login:', p.url())
  const cookies = await p.cookies()
  console.log('Cookies:', cookies.map(c => c.name).join(','))
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

  // Verify session
  const s = await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie: cookieHeader } })
  console.log('session:', s.status, (await s.text()).slice(0, 150))

  // Try verify-password
  const v = await fetch(`${BASE_URL}/api/auth/verify-password`, {
    method: 'POST', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'Admin123!' }),
  })
  console.log('verify-password:', v.status, await v.text())

  // Try reveal
  const r = await fetch(`${BASE_URL}/api/admin/integrations/reveal`, {
    method: 'POST', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'RESEND_API_KEY', password: 'Admin123!' }),
  })
  console.log('reveal:', r.status, await r.text())

  await b.close()
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
