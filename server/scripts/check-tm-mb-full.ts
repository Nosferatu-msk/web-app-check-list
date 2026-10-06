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
  const directEngineers = tmMb.engineersAsTm || [];
  console.log('Количество:', directEngineers.length);
  if (directEngineers.length > 0) {
    const petrovLinked = directEngineers.some((e: any) => e.engineer.email === 'psv.sovteh@gmail.com');
    console.log('Петров С.В. в списке:', petrovLinked ? '✅ ДА' : '❌ НЕТ');
    if (directEngineers.length <= 40) {
      directEngineers.forEach((e: any) => {
        console.log(`  - ${e.engineer.fullName} (${e.engineer.email})`);
      });
    }
  } else {
    console.log('У ТМ_МБ нет прямых инженеров');
  }

  // 2. Команды, где ТМ_МБ — лидер
  console.log('\n=== 2. КОМАНДЫ, ГДЕ ТМ_МБ — ЛИДЕР (tm_team_member.leadTmId = tmMb.id) ===');
  const leadTeams = tmMb.tmTeamAsLead || [];
  console.log('Количество членов команды:', leadTeams.length);
  if (leadTeams.length > 0) {
    leadTeams.forEach((m: any) => {
      console.log(`  - ${m.memberTm.fullName} (${m.memberTm.email}), роль: ${m.memberTm.role}`);
    });
    
    // Получаем инженеров всех членов команды
    const memberIds = leadTeams.map((m: any) => m.memberTmId);
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
    const petrovInTeam = teamEngineers.some((e: any) => e.engineer.email === 'psv.sovteh@gmail.com');
    console.log('Петров С.В. в списке:', petrovInTeam ? '✅ ДА' : '❌ НЕТ');
  } else {
    console.log('ТМ_МБ не является лидером никакой команды');
  }

  // 3. Команды, где ТМ_МБ — член
  console.log('\n=== 3. КОМАНДЫ, ГДЕ ТМ_МБ — ЧЛЕН (tm_team_member.memberTmId = tmMb.id) ===');
  const memberTeams = tmMb.tmTeamAsMember || [];
  console.log('Количество:', memberTeams.length);
  if (memberTeams.length > 0) {
    memberTeams.forEach((m: any) => {
      console.log(`  - Лидер: ${m.leadTm.fullName} (${m.leadTm.email}), роль: ${m.leadTm.role}`);
    });
    
    // Получаем инженеров лидера
    const leadIds = memberTeams.map((m: any) => m.leadTmId);
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
    const petrovInLead = leadEngineers.some((e: any) => e.engineer.email === 'psv.sovteh@gmail.com');
    console.log('Петров С.В. в списке:', petrovInLead ? '✅ ДА' : '❌ НЕТ');
  } else {
    console.log('ТМ_МБ не является членом никакой команды');
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
