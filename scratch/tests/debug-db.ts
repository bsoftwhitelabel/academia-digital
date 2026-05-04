import {prisma} from './harness'

async function main(){
  const t = await prisma.trainee.findFirst({where:{email:'maryluz@decathlon.com'}})
  console.log('Trainee id:', t?.id)
  if (!t) return
  const sessions = await prisma.trainingSession.findMany({
    where: {
      trainingAction: { enrollments: { some: { traineeId: t.id, status: 'CONFIRMED' } } },
    },
    include: {
      trainingAction: {
        include: {
          course: true,
          enrollments: { where: { traineeId: t.id, status: 'CONFIRMED' } },
        },
      },
      checkIns: { where: { traineeId: t.id } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  console.log('Sessions found:', sessions.length)
  for (const s of sessions) {
    console.log('  ' + s.id.slice(0, 12), 'isOpen=' + s.isOpen, 'enrol=' + s.trainingAction.enrollments.length, 'ci=' + s.checkIns.length, s.trainingAction.course.name)
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error('ERR', e); process.exit(1) })
