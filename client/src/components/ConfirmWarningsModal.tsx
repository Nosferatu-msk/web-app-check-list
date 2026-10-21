import { Modal, Button } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

interface ConfirmWarningsModalProps {
  open: boolean;
  visitsCount: number;
  anomaliesCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmWarningsModal({
  open,
  visitsCount,
  anomaliesCount,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmWarningsModalProps) {
  return (
    <Modal
      open={open}
      title="Подтверждение предупреждений"
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>,
        <Button key="confirm" type="primary" onClick={onConfirm} loading={loading}>
          Подтвердить
        </Button>,
      ]}
      style={{ borderRadius: 16 }}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ marginBottom: 12 }}>
          Вы собираетесь подтвердить все предупреждения в следующих визитах:
        </p>
        <div
          style={{
            background: '#F8FAFC',
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Визитов:</span>
            <strong>{visitsCount}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Отклонений:</span>
            <strong>{anomaliesCount}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Критические:</span>
            <strong style={{ color: '#059669' }}>0 (не будут затронуты)</strong>
          </div>
        </div>
        <div
          style={{
            background: '#FEF3C7',
            borderLeft: '3px solid #F59E0B',
            padding: 12,
            borderRadius: 6,
            fontSize: 13,
            color: '#92400E',
          }}
        >
          <WarningOutlined style={{ marginRight: 8 }} />
          Это действие нельзя отменить. Все предупреждения в выбранных визитах будут подтверждены.
        </div>
      </div>
    </Modal>
  );
}
