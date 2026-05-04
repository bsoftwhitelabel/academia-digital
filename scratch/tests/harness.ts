import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole, TrainingFormat, TrainingStatus, CourseStatus, DocumentType, SignatureStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import puppeteer, { Browser, Page } from 'puppeteer'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const prisma = new PrismaClient({ adapter })

export const BASE_URL = 'http://localhost:3000'

export async function launchBrowser(viewport = { width: 1280, height: 800 }): Promise<Browser> {
  return puppeteer.launch({
    headless: 'new' as any,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: viewport,
  })
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('#email')
  await page.type('#email', email)
  await page.type('#password', password)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ])
  await new Promise(r => setTimeout(r, 800))
}

export async function ensureUserAndTrainee(opts: {
  email: string
  password: string
  firstName: string
  lastName: string
  tenantId: string
}) {
  const passwordHash = await bcrypt.hash(opts.password, 10)
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: {
      passwordHash, role: UserRole.TRAINEE, tenantId: opts.tenantId,
      firstName: opts.firstName, lastName: opts.lastName, isActive: true,
    },
    create: {
      email: opts.email,
      passwordHash,
      role: UserRole.TRAINEE,
      firstName: opts.firstName,
      lastName: opts.lastName,
      tenantId: opts.tenantId,
      isActive: true,
    },
  })

  let trainee = await prisma.trainee.findUnique({ where: { userId: user.id } })
  if (!trainee) {
    trainee = await prisma.trainee.create({
      data: {
        tenantId: opts.tenantId,
        userId: user.id,
        firstName: opts.firstName,
        lastName: opts.lastName,
        email: opts.email,
      },
    })
  } else {
    trainee = await prisma.trainee.update({
      where: { id: trainee.id },
      data: { firstName: opts.firstName, lastName: opts.lastName },
    })
  }
  return { user, trainee }
}

export async function ensureAdminUser(opts: {
  email: string
  password: string
  firstName: string
  lastName: string
  tenantId: string
}) {
  const passwordHash = await bcrypt.hash(opts.password, 10)
  return prisma.user.upsert({
    where: { email: opts.email },
    update: { passwordHash, role: UserRole.TENANT_ADMIN, tenantId: opts.tenantId },
    create: {
      email: opts.email,
      passwordHash,
      role: UserRole.TENANT_ADMIN,
      firstName: opts.firstName,
      lastName: opts.lastName,
      tenantId: opts.tenantId,
    },
  })
}

export async function ensureTenant(slug: string, name: string) {
  return prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: { name, slug },
  })
}

export async function ensureTrainer(tenantId: string, email = 'trainer.test@oportoforte.com') {
  const passwordHash = await bcrypt.hash('Trainer123!', 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { tenantId, role: UserRole.TRAINER },
    create: {
      email,
      passwordHash,
      role: UserRole.TRAINER,
      firstName: 'Trainer',
      lastName: 'Test',
      tenantId,
    },
  })
  let trainer = await prisma.trainer.findUnique({ where: { userId: user.id } })
  if (!trainer) {
    trainer = await prisma.trainer.create({
      data: { tenantId, userId: user.id, regions: ['Porto'] },
    })
  }
  return trainer
}

export type CreatedAction = {
  actionId: string
  sessionId: string
  courseId: string
}

export async function createOpenTrainingAction(opts: {
  tenantId: string
  trainerId: string
  courseSlug?: string
}): Promise<CreatedAction> {
  const tenantId = opts.tenantId
  const slug = opts.courseSlug ?? 'teste-001-curso'
  const course = await prisma.course.upsert({
    where: { tenantId_slug: { tenantId, slug } },
    update: {},
    create: {
      tenantId,
      name: 'Curso de Teste TESTE-001',
      slug,
      durationHours: 8,
      format: TrainingFormat.PRESENCIAL,
      status: CourseStatus.PUBLISHED,
    },
  })

  const today = new Date()
  const start = new Date(today)
  start.setHours(8, 0, 0, 0)
  const end = new Date(today)
  end.setHours(18, 0, 0, 0)

  const action = await prisma.trainingAction.create({
    data: {
      tenantId,
      courseId: course.id,
      startDate: start,
      endDate: end,
      format: TrainingFormat.PRESENCIAL,
      status: TrainingStatus.IN_PROGRESS,
    },
  })

  await prisma.trainingActionTrainer.create({
    data: { trainingActionId: action.id, trainerId: opts.trainerId, role: 'MAIN' },
  })

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)

  const session = await prisma.trainingSession.create({
    data: {
      trainingActionId: action.id,
      trainerId: opts.trainerId,
      sessionDate: today,
      startTime: '09:00',
      endTime: '18:00',
      durationHours: 8,
      isOpen: true,
      checkinOpenAt: tenMinAgo,
    },
  })

  return { actionId: action.id, sessionId: session.id, courseId: course.id }
}

export async function enrollTrainee(actionId: string, traineeId: string) {
  return prisma.enrollment.upsert({
    where: { trainingActionId_traineeId: { trainingActionId: actionId, traineeId } },
    update: { status: 'CONFIRMED' },
    create: { trainingActionId: actionId, traineeId, status: 'CONFIRMED' },
  })
}

export function header(title: string) {
  console.log('\n' + '═'.repeat(70))
  console.log('  ' + title)
  console.log('═'.repeat(70))
}

export function pass(msg: string) { console.log('  ✅ ' + msg) }
export function fail(msg: string) { console.log('  ❌ ' + msg) }
export function info(msg: string) { console.log('  ▸  ' + msg) }
