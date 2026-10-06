import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Полная проверка связей ТМ_МБ ===\n');

  // Находим ТМ_МБ
  const tmMb = await prisma.user.findFirst({
    where: { email: 'tm_mb@mb.ru' },
    select: { 
      id: true, 
      fullName: true, 
      role: true,
      // Инженеры, которыми ТМ управляет напрямую
      engineersAsTm: {
        select: {
          engineerId: true,
          engineer: {
            select: {
              fullName: true,
              email: true
            }
          }
        }
      },
      // Команды, где ТМ является лидером
      tmTeamAsLead: {
        select: {
          id: true,
          memberTmId: true,
          memberTm: {
            select: {
              fullName: true,
              email: true,
              role: true
            }
          }
        }
      },
      // Команды, где ТМ является членом
      tmTeamAsMember: {
        select: {
          id: true,
          leadTmId: true,
          leadTm: {
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

  if (!tmMb) {
    console.log('❌ ТМ_МБ не найден');
    return;
  }

  console.log('✅ ТМ_МБ найден:');
  console.log('  ID:', tmMb.id);
  console.log('  ФИО:', tmMb.fullName);
  console.log('  Роль:', tmMb.role);

  // 1. Прямые инженеры
  console.log('\n=== 1. ПРЯМЫЕ ИНЖЕНЕРЫ (tm_engineer.tmId = tmMb.id) ===');
  console.log('Количество:', tmMb.engineersAsTm.length);
  if (tmMb.engineersAsTm.length > 0) {
    const petrovLinked = tmMb.engineersAsTm.some(e => e.engineer.email === 'psv.sovteh@gmail.com');
    console.log('Петров С.В. в списке:', petrovLinked ? '✅ ДА' : '❌ НЕТ');
    if (tmMb.engineersAsTm.length <= 40) {
      tmMb.engineersAsTm.forEach(e => {
        console.log(`  - ${e.engineer.fullName} (${e.engineer.email})`);
      });
    }
  }

  // 2. Команды, где ТМ_МБ — лидер
  console.log('\n=== 2. КОМАНДЫ, ГДЕ ТМ_МБ — ЛИДЕР (tm_team_member.leadTmId = tmMb.id) ===');
  console.log('Количество членов команды:', tmMb.tmTeamAsLead.length);
  if (tmMb.tmTeamAsLead.length > 0) {
    tmMb.tmTeamAsLead.forEach(m => {
      console.log(`  - ${m.memberTm.fullName} (${m.memberTm.email}), роль: ${m.memberTm.role}`);
    });
    
    // Получаем инженеров всех членов команды
    const memberIds = tmMb.tmTeamAsLead.map(m => m.memberTmId);
    const teamEngineers = await prisma.tmEngineer.findMany({
      where: { tmId: { in: memberIds } },
      select: {
        engineerId: true,
        engineer: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });
    
    console.log('\nИнженеры членов команды:');
    console.log('Количество:', teamEngineers.length);
    const petrovInTeam = teamEngineers.some(e => e.engineer.email === 'psv.sovteh@gmail.com');
    console.log('Петров С.В. в списке:', petrovInTeam ? '✅ ДА' : '❌ НЕТ');
  }

  // 3. Команды, где ТМ_МБ — член
  console.log('\n=== 3. КОМАНДЫ, ГДЕ ТМ_МБ — ЧЛЕН (tm_team_member.memberTmId = tmMb.id) ===');
  console.log('Количество:', tmMb.tmTeamAsMember.length);
  if (tmMb.tmTeamAsMember.length > 0) {
    tmMb.tmTeamAsMember.forEach(m => {
      console.log(`  - Лидер: ${m.leadTm.fullName} (${m.leadTm.email}), роль: ${m.leadTm.role}`);
    });
    
    // Получаем инженеров лидера
    const leadIds = tmMb.tmTeamAsMember.map(m => m.leadTmId);
    const leadEngineers = await prisma.tmEngineer.findMany({
      where: { tmId: { in: leadIds } },
      select: {
        engineerId: true,
        engineer: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });
    
    console.log('\nИнженеры лидера:');
    console.log('Количество:', leadEngineers.length);
    const petrovInLead = leadEngineers.some(e => e.engineer.email === 'psv.sovteh@gmail.com');
    console.log('Петров С.В. в списке:', petrovInLead ? '✅ ДА' : '❌ НЕТ');
  }

  // 4. Прямая проверка связи Петров С.В. → ТМ_МБ
  console.log('\n=== 4. ПРЯМАЯ ПРОВЕРКА СВЯЗИ Петров С.В. → ТМ_МБ ===');
  const petrov = await prisma.user.findFirst({
    where: { email: 'psv.sovteh@gmail.com' },
    select: { id: true, fullName: true }
  });
  
  if (petrov) {
    const directLink = await prisma.tmEngineer.findFirst({
      where: {
        tmId: tmMb.id,
        engineerId: petrov.id
      }
    });
    
    if (directLink) {
      console.log('✅ Прямая связь найдена в tm_engineer!');
      console.log('  ID записи:', directLink.id);
      console.log('  Создана:', directLink.createdAt);
    } else {
      console.log('❌ Прямая связь НЕ найдена в tm_engineer');
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
