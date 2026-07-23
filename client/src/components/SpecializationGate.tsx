import { useState } from 'react';
import { Checkbox, Button, App, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

const SPEC_OPTIONS = [
  { key: 'vik' as const, short: 'ВиК', full: 'Вентиляция и Кондиционирование' },
  { key: 'iszh' as const, short: 'ИСЖ', full: 'Инженерные Сети и Электрика' },
  { key: 'gpm' as const, short: 'ГПМ', full: 'Грузоподъёмные механизмы' },
  { key: 'dgu' as const, short: 'ДГУ', full: 'Дизель-генераторные установки' },
  { key: 'ibp' as const, short: 'ИБП', full: 'Источники бесперебойного питания' },
];

export default function SpecializationGate({ children }: { children: React.ReactNode }) {
  const { user, updateSpecialization } = useAuthStore();
  const { message } = App.useApp();
  const [selected, setSelected] = useState<Record<string, boolean>>({
    vik: user?.specializationVik ?? false,
    iszh: user?.specializationIszh ?? false,
    gpm: user?.specializationGpm ?? false,
    dgu: user?.specializationDgu ?? false,
    ibp: user?.specializationIbp ?? false,
  });
  const [loading, setLoading] = useState(false);

  if (user?.role !== 'engineer') return <>{children}</>;
  if (user?.specializationVik || user?.specializationIszh || user?.specializationGpm || user?.specializationDgu || user?.specializationIbp) return <>{children}</>;

  const hasAny = Object.values(selected).some(Boolean);

  const handleSubmit = async () => {
    if (!hasAny) {
      message.warning('Выберите хотя бы одну специализацию');
      return;
    }
    setLoading(true);
    try {
      await updateSpecialization({
        specializationVik: selected.vik,
        specializationIszh: selected.iszh,
        specializationGpm: selected.gpm,
        specializationDgu: selected.dgu,
        specializationIbp: selected.ibp,
      });
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
          {SPEC_OPTIONS.map((spec, idx) => (
            <div key={spec.key} style={{ marginBottom: idx < SPEC_OPTIONS.length - 1 ? 12 : 0 }}>
              <Checkbox
                checked={selected[spec.key]}
                onChange={(e) => setSelected(prev => ({ ...prev, [spec.key]: e.target.checked }))}
                style={{ fontSize: 16 }}
              >
                <Text strong>{spec.short}</Text>
                <Text type="secondary"> ({spec.full})</Text>
              </Checkbox>
            </div>
          ))}
        </div>

        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          disabled={!hasAny}
          onClick={handleSubmit}
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}
