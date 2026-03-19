import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const SALT = 12;
  const DEFAULT_PASS = 'Admin123!';

  console.log('🌱 Ejecutando seed...\n');

  // ── 1. Crear/actualizar los 3 roles del sistema ───────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({
      where:  { name: 'administrador' },
      update: { description: 'Acceso total al sistema' },
      create: { name: 'administrador', description: 'Acceso total al sistema' },
    }),
    prisma.role.upsert({
      where:  { name: 'gestor' },
      update: { description: 'Gestión de contenido — sin acceso a usuarios ni roles' },
      create: { name: 'gestor',        description: 'Gestión de contenido — sin acceso a usuarios ni roles' },
    }),
    prisma.role.upsert({
      where:  { name: 'cliente' },
      update: { description: 'Solo lectura de datos propios y trazabilidad' },
      create: { name: 'cliente',       description: 'Solo lectura de datos propios y trazabilidad' },
    }),
  ]);

  const [roleAdmin, roleGestor, roleCliente] = roles;
  console.log('✅ Roles creados:', roles.map((r) => r.name).join(', '));

  // ── 2. Crear usuarios demo (uno por rol) ─────────────────────────────────
  const hashedPass = await bcrypt.hash(DEFAULT_PASS, SALT);

  const usersData = [
    { nombre: 'Admin Demo',   email: 'admin@demo.com',   roleId: roleAdmin.id   },
    { nombre: 'Gestor Demo',  email: 'gestor@demo.com',  roleId: roleGestor.id  },
    { nombre: 'Cliente Demo', email: 'cliente@demo.com', roleId: roleCliente.id },
  ];

  for (const u of usersData) {
    // upsert del usuario
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { nombre: u.nombre },
      create: { nombre: u.nombre, email: u.email, password: hashedPass },
    });

    // upsert de la asignación de rol
    await prisma.userRole.upsert({
      where:  { userId_roleId: { userId: user.id, roleId: u.roleId } },
      update: {},
      create: { userId: user.id, roleId: u.roleId },
    });

    console.log(`✅ Usuario creado: ${u.email}  →  rol: ${roles.find((r) => r.id === u.roleId)?.name}`);
  }

  console.log(`\n📋 Contraseña para todos los usuarios demo: ${DEFAULT_PASS}`);
  console.log('🏁 Seed completado correctamente');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
