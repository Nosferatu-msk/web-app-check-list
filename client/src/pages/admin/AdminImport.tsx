import { useState, useEffect } from 'react';
import { Card, Button, Upload, Table, Tag, Space, App, Progress, Collapse } from 'antd';
import { UploadOutlined, FileTextOutlined, HistoryOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const API_BASE = '/api/admin/import';

const IMPORT_TYPES = [
  { key: 'addresses', label: 'Адреса объектов', icon: '📋', description: 'CSV: city, street, house, building, full_address, customer_email, object_code' },
  { key: 'equipment-types', label: 'Виды оборудования', icon: '🔧', description: 'CSV: name, code, photos_required, is_active' },
  { key: 'room-types', label: 'Типы помещений', icon: '🏠', description: 'CSV: name, code' },
  { key: 'recommendations', label: 'Типовые рекомендации', icon: '📝', description: 'CSV: equipment_code, text, sort_order, is_active' },
  { key: 'users', label: 'Пользователи', icon: '👥', description: 'CSV: full_name, email, role, password, tm_email' },
  { key: 'tm-objects', label: 'Привязка объектов к ТМ', icon: '🔗', description: 'CSV: object_code, tm_email' },
  { key: 'tm-engineers', label: 'Привязка инженеров к ТМ', icon: '🔗', description: 'CSV: engineer_email, tm_email' },
  { key: 'object-equipment', label: 'Оборудование объектов', icon: '⚙️', description: 'CSV: object_code, equipment_type, room_type, brand, model, serial_number, location_description' },
];

interface ImportResult {
  total: number;
  success: number;
  duplicates: number;
  errors: { row: number; message: string }[];
}

export default function AdminImport() {
  const { message } = App.useApp();
  const [selectedType, setSelectedType] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/admin/import-logs', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleImport = async () => {
    if (!selectedType || fileList.length === 0) { message.warning('Выберите тип и файл'); return; }
    const file = fileList[0];
    if (!file.originFileObj) return;

    setLoading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append('file', file.originFileObj);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/${selectedType}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка импорта');
      }

      const data: ImportResult = await res.json();
      setResult(data);
      if (data.success > 0) message.success(`Загружено: ${data.success}`);
      if (data.errors.length > 0) message.warning(`Ошибок: ${data.errors.length}`);
      loadHistory();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header" style={{ marginBottom: 16 }}>
        <h2>Массовый импорт справочников</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        {IMPORT_TYPES.map(t => (
          <Card
            key={t.key}
            size="small"
            hoverable
            style={{ cursor: 'pointer', border: selectedType === t.key ? '2px solid #1677ff' : '1px solid #f0f0f0' }}
            onClick={() => { setSelectedType(t.key); setResult(null); setFileList([]); }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>{t.icon}</div>
            <div style={{ fontWeight: 600 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{t.description}</div>
          </Card>
        ))}
      </div>

      {selectedType && (
        <Card title={`Импорт: ${IMPORT_TYPES.find(t => t.key === selectedType)?.label}`} style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Upload
              accept=".csv"
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setFileList(fileList)}
            >
              <Button icon={<UploadOutlined />} size="large">Выбрать CSV файл</Button>
            </Upload>

            <Button
              type="primary"
              size="large"
              icon={<FileTextOutlined />}
              loading={loading}
              disabled={fileList.length === 0}
              onClick={handleImport}
              block
            >
              Загрузить
            </Button>

            {loading && <Progress percent={50} status="active" />}

            {result && (
              <Card size="small" title="Результат импорта">
                <Space size="large">
                  <Tag icon={<CheckCircleOutlined />} color="success">Загружено: {result.success}</Tag>
                  <Tag icon={<WarningOutlined />} color="warning">Дубликаты: {result.duplicates}</Tag>
                  <Tag icon={<CloseCircleOutlined />} color="error">Ошибки: {result.errors.length}</Tag>
                  <Tag>Всего: {result.total}</Tag>
                </Space>

                {result.errors.length > 0 && (
                  <Collapse
                    style={{ marginTop: 12 }}
                    items={[{
                      key: 'errors',
                      label: `Ошибки (${result.errors.length})`,
                      children: (
                        <Table
                          size="small"
                          dataSource={result.errors}
                          rowKey="row"
                          pagination={result.errors.length > 10 ? { pageSize: 10 } : false}
                          columns={[
                            { title: 'Строка', dataIndex: 'row', width: 80 },
                            { title: 'Описание', dataIndex: 'message' },
                          ]}
                        />
                      ),
                    }]}
                  />
                )}
              </Card>
            )}
          </Space>
        </Card>
      )}

      <Card title={<span><HistoryOutlined /> История импортов</span>}>
        <Table
          size="small"
          dataSource={history}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Дата', render: (_: any, r: any) => new Date(r.createdAt).toLocaleString('ru-RU') },
            { title: 'Тип', dataIndex: 'entityType' },
            { title: 'Файл', dataIndex: 'fileName' },
            { title: 'Всего', dataIndex: 'totalRows', width: 70 },
            { title: 'Успех', dataIndex: 'successRows', width: 70, render: (v: number) => <Tag color="success">{v}</Tag> },
            { title: 'Дубликаты', dataIndex: 'duplicateRows', width: 90, render: (v: number) => <Tag color="warning">{v}</Tag> },
            { title: 'Ошибки', dataIndex: 'errorRows', width: 70, render: (v: number) => <Tag color={v > 0 ? 'error' : 'default'}>{v}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
