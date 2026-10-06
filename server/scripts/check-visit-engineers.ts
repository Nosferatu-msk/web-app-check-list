import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Проверка VisitEngineer для визитов Петрова С.В. ===\n');

  // Находим договор
  const contract = await prisma.contract.findFirst({
    where: { number: '050005596590' },
    select: { id: true }
  });
  
  if (!contract) {
    console.log('Договор не найден');
    return;
  }
  
  const from = new Date('2026-09-01T00:00:00');
  const to = new Date('2026-09-30T23:59:59');
  
  // Находим визиты с userId = ТМ_МБ
  const tmMbId = 'b9758bf8-cf33-4d13-a741-edbb4d55748f';
  const visits = await prisma.visit.findMany({
    where: {
      contractId: contract.id,
      isDeleted: false,
      dateStart: { gte: from, lte: to },
      userId: tmMbId
    },
    select: {
      id: true,
      engineerName: true,
      dateStart: true,
      visitEngineers: {
        select: {
          engineerId: true,
          engineer: {
            select: {
              fullName: true,
              email: true
            }
          }
        }
      }
    }
  });
  
  console.log('Визитов с userId = ТМ_МБ:', visits.length);
  
  if (visits.length > 0) {
    console.log('\nПроверка VisitEngineer:');
    visits.slice(0, 10).forEach(v => {
      console.log(`\n  Визит ${v.id}:`);
      console.log(`    Дата: ${v.dateStart.toLocaleDateString('ru-RU')}`);
      console.log(`    Инженер (engineerName): ${v.engineerName}`);
      console.log(`    VisitEngineers: ${v.visitEngineers.length}`);
      v.visitEngineers.forEach(ve => {
        console.log(`      - ${ve.engineer.fullName} (${ve.engineer.email})`);
      });
    });
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
