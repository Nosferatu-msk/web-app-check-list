import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Режим обслуживания: true = только админ может работать
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';

const MAINTENANCE_HTML = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Техническое обслуживание</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0F766E 0%, #14B8A6 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px 32px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: #FEF3C7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }
    h1 {
      color: #1F2937;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    p {
      color: #6B7280;
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #E5E7EB;
      color: #9CA3AF;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔧</div>
    <h1>Техническое обслуживание</h1>
    <p>Приложение временно недоступно для большинства пользователей.</p>
    <p>Администратор проводит проверку данных.</p>
    <div class="footer">
      Приносим извинения за неудобства.<br>
      Доступ будет восстановлен в ближайшее время.
    </div>
  </div>
</body>
</html>
`;

export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  // Если режим обслуживания выключен — пропускаем
  if (!MAINTENANCE_MODE) {
    return next();
  }

  // Пропускаем health check и version info
  if (req.path === '/api/health' || req.path === '/api/version') {
    return next();
  }

  // Пропускаем auth routes (чтобы можно было логиниться)
  if (req.path.startsWith('/api/auth')) {
    return next();
  }

  // Проверяем токен и роль
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      
      // Админ может работать
      if (payload.role === 'admin') {
        return next();
      }
    } catch {
      // Токен недействителен — покажем заглушку
    }
  }

  // Для API-запросов возвращаем JSON
  if (req.path.startsWith('/api/')) {
    return res.status(503).json({ 
      error: 'Техническое обслуживание',
      message: 'Приложение временно недоступно. Администратор проводит проверку данных.'
    });
  }

  // Для остальных запросов возвращаем HTML
  return res.status(503).send(MAINTENANCE_HTML);
}
