import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Проверка записи tm_engineer для Петров С.В. ===\n');

  // Находим прямую связь
  const link = await prisma.tmEngineer.findFirst({
    where: {
      tmId: 'b9758bf8-cf33-4d13-a741-edbb4d55748f',
      engineerId: '92b81fc8-d4bd-4bd0-a98b-3cfcc393b716'
    },
    select: {
      id: true,
      tmId: true,
      engineerId: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (link) {
    console.log('✅ Связь найдена:');
    console.log('  ID:', link.id);
    console.log('  TM ID:', link.tmId);
    console.log('  Engineer ID:', link.engineerId);
    console.log('  Создана:', link.createdAt);
    console.log('  Обновлена:', link.updatedAt);
  } else {
    console.log('❌ Связь НЕ найдена');
    return;
  }

  // Проверяем, сколько всего записей для этого ТМ
  console.log('\n=== Все записи tm_engineer для ТМ_МБ ===');
  const allLinks = await prisma.tmEngineer.findMany({
    where: { tmId: 'b9758bf8-cf33-4d13-a741-edbb4d55748f' },
    select: {
      id: true,
      engineerId: true,
      engineer: {
        select: {
          fullName: true,
          email: true,
          role: true,
          isActive: true
        }
      }
    }
  });

  console.log('Количество:', allLinks.length);
  allLinks.forEach(l => {
    console.log(`  - ${l.engineer.fullName} (${l.engineer.email}), роль: ${l.engineer.role}, активен: ${l.engineer.isActive}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
