import { useState } from 'react';
import { Checkbox, Button, App, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

export default function SpecializationGate({ children }: { children: React.ReactNode }) {
  const { user, updateSpecialization } = useAuthStore();
  const { message } = App.useApp();
  const [vik, setVik] = useState(user?.specializationVik ?? false);
  const [iszh, setIszh] = useState(user?.specializationIszh ?? false);
  const [loading, setLoading] = useState(false);

  // If user is not an engineer, or already has at least one specialization — pass through
  if (user?.role !== 'engineer') return <>{children}</>;
  if (user?.specializationVik || user?.specializationIszh) return <>{children}</>;

  const handleSubmit = async () => {
    if (!vik && !iszh) {
      message.warning('Выберите хотя бы одну специализацию');
      return;
    }
    setLoading(true);
    try {
      await updateSpecialization({ specializationVik: vik, specializationIszh: iszh });
      message.success('Специализация сохранена');
    } catch (err: any) {
      message.error(err.message || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: 24,
      background: '#f5f5f5',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 32,
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
          <Title level={3} style={{ marginBottom: 8 }}>Выберите специализацию</Title>
          <Text type="secondary">
            Для продолжения работы необходимо выбрать хотя бы одну специализацию.
          </Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <Checkbox
              checked={vik}
              onChange={(e) => setVik(e.target.checked)}
              style={{ fontSize: 16 }}
            >
              <Text strong>ВиК</Text>
              <Text type="secondary"> (Вентиляция и Кондиционирование)</Text>
            </Checkbox>
          </div>
          <div>
            <Checkbox
              checked={iszh}
              onChange={(e) => setIszh(e.target.checked)}
              style={{ fontSize: 16 }}
            >
              <Text strong>ИСЖ</Text>
              <Text type="secondary"> (Инженерные Сети и Электрика)</Text>
            </Checkbox>
          </div>
        </div>

        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          disabled={!vik && !iszh}
          onClick={handleSubmit}
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}
