import React from 'react';
import { ToolOutlined } from '@ant-design/icons';

const MaintenancePage: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
      padding: 20,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: '48px 32px',
        maxWidth: 480,
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: 80,
          height: 80,
          margin: '0 auto 24px',
          background: '#FEF3C7',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
        }}>
          <ToolOutlined style={{ color: '#D97706' }} />
        </div>
        <h1 style={{
          color: '#1F2937',
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 12,
        }}>
          Техническое обслуживание
        </h1>
        <p style={{
          color: '#6B7280',
          fontSize: 16,
          lineHeight: 1.5,
          marginBottom: 8,
        }}>
          Приложение временно недоступно для большинства пользователей.
        </p>
        <p style={{
          color: '#6B7280',
          fontSize: 16,
          lineHeight: 1.5,
          marginBottom: 8,
        }}>
          Администратор проводит проверку данных.
        </p>
        <div style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: '1px solid #E5E7EB',
          color: '#9CA3AF',
          fontSize: 14,
        }}>
          Приносим извинения за неудобства.<br />
          Доступ будет восстановлен в ближайшее время.
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
