import { useState, useEffect } from 'react';
import { Card, Button, Upload, Table, Tag, Space, App, Steps, Alert, Collapse, Spin, Typography } from 'antd';
import { UploadOutlined, FileTextOutlined, HistoryOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, SearchOutlined, CheckCircleFilled } from '@ant-design/icons';
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

interface ValidateResult {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  duplicates: { row: number; value: string }[];
  errors: { row: number; message: string }[];
}

export default function AdminImport() {
  const { message } = App.useApp();
  const [selectedType, setSelectedType] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'validating' | 'importing'>('idle');
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

  const handleValidate = async () => {
    if (!selectedType || fileList.length === 0) { message.warning('Выберите тип и файл'); return; }
    const file = fileList[0];
    if (!file.originFileObj) return;

    setLoading(true);
    setPhase('validating');
    setValidateResult(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append('file', file.originFileObj);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/${selectedType}?mode=validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка проверки');
      }

      const data: ValidateResult = await res.json();
      setValidateResult(data);
      setPhase('idle');

      if (data.errorRows === 0 && data.duplicateRows === 0) {
        message.success(`Файл корректен: ${data.validRows} строк`);
      } else if (data.errorRows === 0) {
        message.warning(`Ошибок нет, но найдено ${data.duplicateRows} дубликатов`);
      } else {
        message.warning(`Найдено ошибок: ${data.errorRows}`);
      }
    } catch (err: any) {
      message.error(err.message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedType || fileList.length === 0) { message.warning('Выберите тип и файл'); return; }
    const file = fileList[0];
    if (!file.originFileObj) return;

    setLoading(true);
    setPhase('importing');
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
      setPhase('idle');
      if (data.success > 0) message.success(`Загружено: ${data.success}`);
      if (data.errors.length > 0) message.warning(`Ошибок: ${data.errors.length}`);
      loadHistory();
    } catch (err: any) {
      message.error(err.message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const currentStep = phase === 'validating' ? 0 : phase === 'importing' ? 1 : -1;

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
            onClick={() => { setSelectedType(t.key); setResult(null); setValidateResult(null); setFileList([]); setPhase('idle'); }}
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
              onChange={({ fileList }) => { setFileList(fileList); setValidateResult(null); setResult(null); setPhase('idle'); }}
              disabled={loading}
            >
              <Button icon={<UploadOutlined />} size="large" disabled={loading}>Выбрать CSV файл</Button>
            </Upload>

            {phase !== 'idle' && (
              <Steps
                current={currentStep}
                size="small"
                items={[
                  { title: 'Проверка файла...', icon: phase === 'validating' ? <Spin size="small" /> : undefined },
                  { title: 'Загрузка данных...', icon: phase === 'importing' ? <Spin size="small" /> : undefined },
                ]}
              />
            )}

            <Space style={{ width: '100%' }} size="middle">
              <Button
                size="large"
                icon={<SearchOutlined />}
                loading={phase === 'validating'}
                disabled={fileList.length === 0 || loading}
                onClick={handleValidate}
              >
                Проверить файл
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<FileTextOutlined />}
                loading={phase === 'importing'}
                disabled={fileList.length === 0 || loading}
                onClick={handleImport}
              >
                Загрузить
              </Button>
            </Space>

            {/* Validation results */}
            {validateResult && (
              <Card size="small" title="Результат проверки файла">
                <Space size="large" style={{ marginBottom: 12 }}>
                  <Tag>Всего строк: {validateResult.totalRows}</Tag>
                  <Tag icon={<CheckCircleOutlined />} color="success">Корректных: {validateResult.validRows}</Tag>
                  <Tag icon={<WarningOutlined />} color="warning">Дубликаты: {validateResult.duplicateRows}</Tag>
                  <Tag icon={<CloseCircleOutlined />} color="error">Ошибки: {validateResult.errorRows}</Tag>
                </Space>

                {validateResult.errorRows === 0 && validateResult.duplicateRows === 0 && (
                  <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleFilled />}
                    message="Файл полностью корректен"
                    description={`Все ${validateResult.totalRows} строк готовы к импорту.`}
                    style={{ marginTop: 8 }}
                  />
                )}

                {validateResult.errorRows > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    message="Обнаружены ошибки"
                    description="Исправьте ошибки в файле перед импортом."
                    style={{ marginTop: 8, marginBottom: 12 }}
                  />
                )}

                {validateResult.duplicateRows > 0 && validateResult.errorRows === 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Найдены дубликаты"
                    description="Дубликаты будут пропущены при импорте. Остальные строки будут загружены."
                    style={{ marginTop: 8, marginBottom: 12 }}
                  />
                )}

                <Collapse
                  style={{ marginTop: 12 }}
                  defaultActiveKey={validateResult.errorRows > 0 ? ['errors'] : []}
                  items={[
                    ...(validateResult.duplicates.length > 0 ? [{
                      key: 'duplicates',
                      label: `Дубликаты (${validateResult.duplicates.length})`,
                      children: (
                        <Table
                          size="small"
                          dataSource={validateResult.duplicates}
                          rowKey="row"
                          pagination={validateResult.duplicates.length > 10 ? { pageSize: 10 } : false}
                          columns={[
                            { title: 'Строка', dataIndex: 'row', width: 80 },
                            { title: 'Значение', dataIndex: 'value', ellipsis: true },
                          ]}
                        />
                      ),
                    }] : []),
                    ...(validateResult.errors.length > 0 ? [{
                      key: 'errors',
                      label: `Ошибки (${validateResult.errors.length})`,
                      children: (
                        <Table
                          size="small"
                          dataSource={validateResult.errors}
                          rowKey="row"
                          pagination={validateResult.errors.length > 10 ? { pageSize: 10 } : false}
                          columns={[
                            { title: 'Строка', dataIndex: 'row', width: 80 },
                            { title: 'Описание', dataIndex: 'message' },
                          ]}
                        />
                      ),
                    }] : []),
                  ]}
                />

                {validateResult.validRows > 0 && (
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    style={{ marginTop: 16 }}
                    disabled={loading}
                    onClick={handleImport}
                  >
                    Загрузить корректные строки ({validateResult.validRows})
                  </Button>
                )}
              </Card>
            )}

            {/* Import results */}
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
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'] }}
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
