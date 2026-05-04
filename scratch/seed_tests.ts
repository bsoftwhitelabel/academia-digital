import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole, EnrollmentStatus, TrainingFormat, TrainingStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'oportoforte' } })
  if (!tenant) throw new Error('Tenant oportoforte não encontrado!')

  // 1. Criar Trainee user (Maryluz)
  const passwordHash = await bcrypt.hash('Trainee123!', 10)
  const traineeUser = await prisma.user.upsert({
    where: { email: 'maryluz@decathlon.com' },
    update: {},
    create: {
      email: 'maryluz@decathlon.com',
      passwordHash,
      role: UserRole.TRAINEE,
      firstName: 'Mary',
      lastName: 'Luz',
      tenantId: tenant.id,
    },
  })
  console.log('✓ Trainee User:', traineeUser.email)

  // 2. Criar registo Trainee
  const trainee = await prisma.trainee.upsert({
    where: { userId: traineeUser.id },
    update: {},
    create: {
      userId: traineeUser.id,
      tenantId: tenant.id,
      firstName: 'Mary',
      lastName: 'Luz',
      email: 'maryluz@decathlon.com',
      nif: '123456789',
    },
  })
  console.log('✓ Trainee profile:', trainee.id)

  // 3. Buscar um curso
  const course = await prisma.course.findFirst({ where: { tenantId: tenant.id } })
  if (!course) throw new Error('Nenhum curso encontrado!')

  // 4. Criar TrainingAction
  const today = new Date()
  const endDate = new Date(today)
  endDate.setMonth(endDate.getMonth() + 1)

  const action = await prisma.trainingAction.upsert({
    where: { id: 'action_test_001' },
    update: { status: TrainingStatus.IN_PROGRESS },
    create: {
      id: 'action_test_001',
      tenantId: tenant.id,
      courseId: course.id,
      actionCode: 'ACT-TEST-001',
      format: TrainingFormat.ELEARNING,
      status: TrainingStatus.IN_PROGRESS,
      startDate: today,
      endDate: endDate,
    },
  })
  console.log('✓ TrainingAction:', action.id)

  // 4b. Criar Trainer para a sessão
  const trainerUser = await prisma.user.upsert({
    where: { email: 'formador@oportoforte.com' },
    update: {},
    create: {
      email: 'formador@oportoforte.com',
      passwordHash: await bcrypt.hash('Formador123!', 10),
      role: UserRole.TRAINER,
      firstName: 'Carlos',
      lastName: 'Formador',
      tenantId: tenant.id,
    },
  })

  const trainer = await prisma.trainer.upsert({
    where: { userId: trainerUser.id },
    update: {},
    create: {
      userId: trainerUser.id,
      tenantId: tenant.id,
    },
  })
  console.log('✓ Trainer:', trainer.id)

  // 5. Criar TrainingSession para HOJE com isOpen=true
  const now = new Date()
  const checkinOpenAt = new Date(now.getTime() - 10 * 60 * 1000) // agora - 10 min
  const checkinCloseAt = new Date(now.getTime() + 2 * 60 * 60 * 1000) // agora + 2h

  const session = await prisma.trainingSession.upsert({
    where: { id: 'session_test_001' },
    update: {
      isOpen: true,
      checkinOpenAt,
      checkinCloseAt,
    },
    create: {
      id: 'session_test_001',
      trainingActionId: action.id,
      trainerId: trainer.id,
      sessionDate: today,
      startTime: '18:30',
      endTime: '22:30',
      durationHours: 4,
      isOpen: true,
      isClosed: false,
      checkinOpenAt,
      checkinCloseAt,
    },
  })
  console.log('✓ TrainingSession:', session.id, '| isOpen:', session.isOpen)

  // 6. Enrollment da Maryluz
  const enrollment = await prisma.enrollment.upsert({
    where: { id: 'enrollment_test_001' },
    update: {},
    create: {
      id: 'enrollment_test_001',
      traineeId: trainee.id,
      trainingActionId: action.id,
      status: 'CONFIRMED',
    },
  })
  console.log('✓ Enrollment:', enrollment.id)

  console.log('\n✅ Dados de teste criados com sucesso!')
  console.log('Login: maryluz@decathlon.com / Trainee123!')
  console.log('Session ID:', session.id)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
