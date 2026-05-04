import { prisma } from './harness'

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'oportoforte' } })
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  ESTADO ACTUAL DA BD (oportoforte)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Tenant: ${tenant?.name} (slug=${tenant?.slug})`)
  console.log(`  Logo: ${tenant?.logoUrl ? 'definido' : '—'}`)
  console.log(`  Email from: ${tenant?.emailFromAddress || '—'}`)
  console.log()

  const users = await prisma.user.findMany({
    where: { tenantId: tenant!.id },
    orderBy: { role: 'asc' },
  })
  console.log(`USERS (${users.length}):`)
  for (const u of users) {
    console.log(`  ${u.role.padEnd(15)} ${u.email}`)
  }
  console.log()

  const counts = {
    courses: await prisma.course.count({ where: { tenantId: tenant!.id } }),
    actions: await prisma.trainingAction.count({ where: { tenantId: tenant!.id } }),
    sessionsOpen: await prisma.trainingSession.count({
      where: { isOpen: true, trainingAction: { tenantId: tenant!.id } },
    }),
    enrolments: await prisma.enrollment.count({
      where: { trainingAction: { tenantId: tenant!.id } },
    }),
    certificates: await prisma.certificate.count({
      where: { trainee: { tenantId: tenant!.id } },
    }),
    inquiries: await prisma.inquiry.count({ where: { tenantId: tenant!.id } }),
    notifLogs: await prisma.notificationLog.count({ where: { tenantId: tenant!.id } }),
    auditLogs: await prisma.auditLog.count({ where: { tenantId: tenant!.id } }),
  }
  console.log('CONTAGENS:')
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(15)} ${v}`)
  console.log()

  const openSession = await prisma.trainingSession.findFirst({
    where: { isOpen: true, trainingAction: { tenantId: tenant!.id } },
    include: { trainingAction: { include: { course: true, enrollments: { include: { trainee: true } } } } },
  })
  if (openSession) {
    console.log('SESSÃO ABERTA AGORA:')
    console.log(`  Curso: ${openSession.trainingAction.course.name}`)
    console.log(`  Sessão ID: ${openSession.id}`)
    console.log(`  Inscritos: ${openSession.trainingAction.enrollments.length}`)
    console.log(`  Check-in window até: ${openSession.checkinCloseAt?.toISOString()}`)
    for (const e of openSession.trainingAction.enrollments) {
      console.log(`    • ${e.trainee.firstName} ${e.trainee.lastName} (${e.trainee.email})`)
    }
  } else {
    console.log('SESSÃO ABERTA AGORA: nenhuma')
  }
  await prisma.$disconnect()
}
main()
