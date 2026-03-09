import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {

  const password = await bcrypt.hash('123456', 10)



  /* ---------- USUARIOS ---------- */

  const adminUser = await prisma.user.create({
    data: {
      nombre: 'Administrador',
      email: 'admin@demo.com',
      password: password
    }
  })

  const clientUser = await prisma.user.create({
    data: {
      nombre: 'Cliente',
      email: 'client@demo.com',
      password: password
    }
  })

  const supportUser = await prisma.user.create({
    data: {
      nombre: 'Soporte',
      email: 'support@demo.com',
      password: password
    }
  })

 
  console.log('Seed ejecutado correctamente')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })