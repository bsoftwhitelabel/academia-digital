import {prisma} from './harness'

async function main(){
  const t = await prisma.trainee.findFirst({where:{email:'maryluz@decathlon.com'}})
  console.log('Trainee id:', t?.id)
  const lastSession = await prisma.trainingSession.findFirst({
    where: { trainingAction: { enrollments: { some: { traineeId: t!.id } } } },
    orderBy: { createdAt: 'desc' },
  })
  console.log('Latest session:', lastSession?.id)
  // Reproduce the exact query from the check-in page
  try {
    const trainingSession = await prisma.trainingSession.findUnique({
      where: { id: lastSession!.id },
      include: {
        trainingAction: {
          include: {
            course: true,
            enrollments: {
              where: { traineeId: t!.id, status: 'CONFIRMED' },
            },
          },
        },
        room: true,
        checkIns: {
          where: { traineeId: t!.id },
        },
      },
    })
    console.log('Page-style query OK')
    console.log('  isOpen:', trainingSession?.isOpen)
    console.log('  enrolments:', trainingSession?.trainingAction.enrollments.length)
    console.log('  checkIns:', trainingSession?.checkIns.length)
    console.log('  checkinOpenAt:', trainingSession?.checkinOpenAt?.toISOString())
    console.log('  checkinCloseAt:', trainingSession?.checkinCloseAt?.toISOString())
  } catch (e: any) {
    console.error('Page-style query FAILED:', e?.message)
  }
}
main().then(() => prisma.$disconnect())
