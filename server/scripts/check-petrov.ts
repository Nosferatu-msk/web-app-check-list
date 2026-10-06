import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Проверка инженера Петров С.В. ===\n');

  // Находим инженера
  const petrov: any = await prisma.user.findFirst({
    where: { email: 'psv.sovteh@gmail.com' },
    select: { 
      id: true, 
      fullName: true, 
      email: true, 
      role: true,
      tmEngineers: {
        select: {
          tmId: true,
          tm: {
            select: {
              fullName: true,
              email: true,
              role: true
            }
          }
        }
      }
    }
  });

  if (!petrov) {
    console.log('❌ Инженер не найден');
    return;
  }

  console.log('✅ Инженер найден:');
  console.log('  ID:', petrov.id);
  console.log('  ФИО:', petrov.fullName);
  console.log('  Email:', petrov.email);
  console.log('  Роль:', petrov.role);

  if (petrov.tmEngineers && petrov.tmEngineers.length > 0) {
    console.log('\n👥 Привязки к ТМ:');
    petrov.tmEngineers.forEach((te: any) => {
      console.log(`  - ТМ: ${te.tm.fullName} (${te.tm.email}), роль: ${te.tm.role}`);
    });
  } else {
    console.log('\n❌ Инженер НЕ привязан ни к одному ТМ!');
  }

  // Проверяем ТМ_МБ
  const tmMb = await prisma.user.findFirst({
    where: { email: 'tm_mb@mb.ru' },
    select: { id: true, fullName: true }
  });

  if (tmMb) {
    console.log('\n=== Проверка привязки к ТМ_МБ ===');
    const isLinked = petrov.tmEngineers && petrov.tmEngineers.some((te: any) => te.tmId === tmMb.id);
    if (isLinked) {
      console.log('✅ Инженер привязан к ТМ_МБ');
    } else {
      console.log('❌ Инженер НЕ привязан к ТМ_МБ');
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
