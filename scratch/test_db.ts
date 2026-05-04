import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

async function test() {
  console.log('Connecting to:', process.env.DATABASE_URL?.substring(0, 20) + '...')
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
  
  try {
    const tenants = await prisma.tenant.findMany()
    console.log('Success! Found tenants:', tenants.length)
  } catch (err) {
    console.error('Failed to connect:', err)
  } finally {
    await prisma.$disconnect()
  }
}

test()
