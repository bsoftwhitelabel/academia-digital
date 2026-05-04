import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole, CourseStatus, TrainingFormat } from '@prisma/client'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. Criar Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'oportoforte' },
    update: {},
    create: {
      name: 'Grupo Oporto Forte',
      slug: 'oportoforte',
    },
  })
  console.log('✓ Tenant:', tenant.name)

  // 2. Criar User TENANT_ADMIN
  const passwordHash = await bcrypt.hash('Admin123!', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@oportoforte.com' },
    update: {},
    create: {
      email: 'admin@oportoforte.com',
      passwordHash,
      role: UserRole.TENANT_ADMIN,
      firstName: 'Admin',
      lastName: 'Oporto',
      tenantId: tenant.id,
    },
  })
  console.log('✓ Admin:', adminUser.email)

  // 3. Criar 3 ClientOrgs
  const clients = ['Decathlon', 'ZF Automotive', 'Safira Services']
  for (const clientName of clients) {
    const existing = await prisma.clientOrg.findFirst({
      where: { name: clientName, tenantId: tenant.id },
    })
    if (!existing) {
      await prisma.clientOrg.create({
        data: { name: clientName, tenantId: tenant.id, country: 'PT' },
      })
    }
  }
  console.log('✓ ClientOrgs criados')

  // 4. Criar 5 cursos (PUBLISHED)
  const courses = [
    { name: 'Liderança e Gestão de Equipas', slug: 'lideranca-gestao', duration: 40 },
    { name: 'Comunicação Assertiva', slug: 'comunicacao-assertiva', duration: 20 },
    { name: 'Gestão de Tempo e Produtividade', slug: 'gestao-tempo', duration: 16 },
    { name: 'Inteligência Emocional', slug: 'inteligencia-emocional', duration: 24 },
    { name: 'Atendimento de Excelência', slug: 'atendimento-excelencia', duration: 30 },
  ]

  for (const courseData of courses) {
    await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: courseData.slug } },
      update: {},
      create: {
        name: courseData.name,
        slug: courseData.slug,
        durationHours: courseData.duration,
        format: TrainingFormat.ELEARNING,
        status: CourseStatus.PUBLISHED,
        tenantId: tenant.id,
      },
    })
  }
  console.log('✓ 5 cursos criados')
  console.log('\n✅ Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
