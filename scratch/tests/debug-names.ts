import {prisma} from './harness'
async function main() {
  const u = await prisma.user.findUnique({
    where: { email: 'maryluz@decathlon.com' },
    include: { traineeProfile: true },
  })
  console.log('User:', u?.firstName, '/', u?.lastName)
  console.log('Trainee:', u?.traineeProfile?.firstName, '/', u?.traineeProfile?.lastName)
}
main().finally(() => prisma.$disconnect())
