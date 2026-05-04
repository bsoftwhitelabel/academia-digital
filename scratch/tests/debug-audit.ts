import { prisma } from './harness'
async function main() {
  const recent = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  console.log('Recent audit logs:', recent.length)
  for (const r of recent) {
    console.log(`  ${r.createdAt.toISOString()} ${r.action} ${r.resource} userId=${r.userId?.slice(0,8)} ip=${r.ipAddress || '-'}`)
  }
  await prisma.$disconnect()
}
main()
