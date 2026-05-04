import { prisma } from './harness'

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'oportoforte' } })
  if (!tenant) { console.error('tenant não existe'); process.exit(1) }

  // 1. Fechar TODAS as sessões abertas excepto a do curso "Segurança e Higiene"
  const shtCourse = await prisma.course.findFirst({
    where: { tenantId: tenant.id, name: 'Segurança e Higiene no Trabalho' },
  })
  if (!shtCourse) { console.error('curso SHT não existe — corre o test-final primeiro'); process.exit(1) }

  const shtAction = await prisma.trainingAction.findFirst({
    where: { courseId: shtCourse.id, tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  })
  if (!shtAction) { console.error('action SHT não existe'); process.exit(1) }

  const shtSession = await prisma.trainingSession.findFirst({
    where: { trainingActionId: shtAction.id },
    orderBy: { createdAt: 'desc' },
  })
  if (!shtSession) { console.error('session SHT não existe'); process.exit(1) }

  // Fechar todas as outras
  const otherClosed = await prisma.trainingSession.updateMany({
    where: { isOpen: true, id: { not: shtSession.id } },
    data: { isOpen: false, isClosed: true, closedAt: new Date() },
  })
  console.log(`✓ ${otherClosed.count} sessões antigas fechadas`)

  // Reabrir a SHT (caso não esteja) e estender janela
  await prisma.trainingSession.update({
    where: { id: shtSession.id },
    data: {
      isOpen: true,
      isClosed: false,
      closedAt: null,
      checkinOpenAt: new Date(Date.now() - 10 * 60 * 1000),
      checkinCloseAt: new Date(Date.now() + 6 * 3600 * 1000),
    },
  })
  console.log(`✓ Sessão SHT reaberta (id=${shtSession.id.slice(0, 8)}…)`)

  // Limpar check-in da Maryluz para que o "Confirmar Presença" volte a aparecer
  const maryluz = await prisma.trainee.findFirst({ where: { email: 'maryluz@decathlon.com' } })
  if (maryluz) {
    const removed = await prisma.checkIn.deleteMany({ where: { sessionId: shtSession.id, traineeId: maryluz.id } })
    console.log(`✓ Check-ins da Maryluz removidos: ${removed.count}`)
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  AMBIENTE PRONTO PARA DEMO')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Sessão aberta: ${shtCourse.name}`)
  console.log(`Action ID: ${shtAction.id}`)
  console.log(`Session ID: ${shtSession.id}`)
  console.log()

  await prisma.$disconnect()
}
main()
