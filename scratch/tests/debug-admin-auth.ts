import { launchBrowser, loginAs, BASE_URL, prisma } from './harness'
async function main(){
  const b = await launchBrowser()
  const p = await b.newPage()
  await loginAs(p, 'admin@oportoforte.com', 'Admin123!')
  const cookies = await p.cookies()
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  console.log('URL after login:', p.url())
  console.log('Cookies:', cookies.map(c=>c.name).join(','))
  const sess = await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie: cookieHeader } })
  console.log('session HTTP:', sess.status, (await sess.text()).slice(0,200))
  const enr = await fetch(`${BASE_URL}/api/enrollments`, { method: 'POST', headers: { cookie: cookieHeader, 'Content-Type': 'application/json' }, body: '{}' })
  console.log('enrollments HTTP:', enr.status, (await enr.text()).slice(0,200))
  await b.close()
  await prisma.$disconnect()
}
main().catch(e=>{console.error(e); process.exit(1)})
