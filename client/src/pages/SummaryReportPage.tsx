import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Radio, DatePicker, Select, Button, Space, App, Form, Upload, Modal, Checkbox } from 'antd';
import { ArrowLeftOutlined, FilePdfOutlined, InboxOutlined, DeleteOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { RangePicker } = DatePicker;

interface ScanFile {
  uid: string;
  name: string;
  size: number;
  file: File;
}

export default function SummaryReportPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { message, modal } = App.useApp();

  const [reportType, setReportType] = useState<'period' | 'objects'>('period');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [engineerId, setEngineerId] = useState<string>('');
  const [engineers, setEngineers] = useState<any[]>([]);

  const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([]);
  const [addressOptions, setAddressOptions] = useState<any[]>([]);
  const [addressSearch, setAddressSearch] = useState('');

  const [scanFiles, setScanFiles] = useState<ScanFile[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEngineers = useCallback(async () => {
    try {
      const res = await fetch('/api/refs/engineers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      if (res.ok) setEngineers(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadEngineers(); }, [loadEngineers]);

  const searchAddresses = useCallback(async (q: string) => {
    if (q.length >= 2) {
      try {
        const results = await api.searchAddresses(q);
        setAddressOptions(results);
      } catch { /* ignore */ }
    }
  }, []);

  const handleAddressSearch = (value: string) => {
    setAddressSearch(value);
    searchAddresses(value);
  };

  const handleAddScans = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    const newScans: ScanFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowed.includes(file.type)) {
        message.warning(`Файл ${file.name} имеет недопустимый формат. Разрешены: JPG, PNG, PDF`);
        continue;
      }
      newScans.push({ uid: `${Date.now()}-${i}`, name: file.name, size: file.size, file });
    }

    const total = [...scanFiles, ...newScans];
    if (total.length > 10) {
      message.warning('Максимум 10 файлов');
      setScanFiles(total.slice(0, 10));
    } else {
      setScanFiles(total);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeScan = (uid: string) => {
    setScanFiles(prev => prev.filter(f => f.uid !== uid));
  };

  const getTotalScanSize = () => scanFiles.reduce((s, f) => s + f.size, 0);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const handleGenerate = async () => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('Укажите период');
      return;
    }
    if (reportType === 'objects' && selectedAddressIds.length === 0) {
      message.warning('Выберите хотя бы один объект');
      return;
    }

    const totalSize = getTotalScanSize();
    if (totalSize > 50 * 1024 * 1024) {
      message.error('Превышен максимальный размер сканов (50 МБ)');
      return;
    }

    setLoading(true);
    try {
      let scanIds: string[] = [];
      if (scanFiles.length > 0) {
        const uploadResult = await api.uploadActScans(scanFiles.map(f => f.file));
        scanIds = uploadResult.scanIds;
      }

      await api.generateUnifiedReport({
        type: reportType,
        dateFrom: dateRange[0].format('YYYY-MM-DD'),
        dateTo: dateRange[1].format('YYYY-MM-DD'),
        addressIds: reportType === 'objects' ? selectedAddressIds : undefined,
        engineerId: engineerId || undefined,
        scanIds: scanIds.length > 0 ? scanIds : undefined,
      });

      message.success('Отчёт сформирован и скачан');
      setScanFiles([]);
    } catch (err: any) {
      message.error(err.message || 'Ошибка формирования отчёта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="page-title">Формирование сводного отчёта</div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Назад</Button>
      </div>

      <Card style={{ maxWidth: 600 }}>
        <Form layout="vertical">
          <Form.Item label="Тип отчёта" required>
            <Radio.Group value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <Radio.Button value="period">Отчёт за период</Radio.Button>
              <Radio.Button value="objects">Отчёт по объектам</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {reportType === 'objects' && (
            <Form.Item label="Выбор объектов" required>
              <Select
                mode="multiple"
                showSearch
                filterOption={false}
                onSearch={handleAddressSearch}
                placeholder="Начните вводить адрес (мин. 2 символа)"
                value={selectedAddressIds}
                onChange={setSelectedAddressIds}
                options={addressOptions.map((a: any) => ({
                  value: a.id,
                  label: a.fullAddress,
                }))}
                notFoundContent="Адрес не найден"
                style={{ width: '100%' }}
                maxTagCount={3}
              />
              {selectedAddressIds.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                  Выбрано объектов: {selectedAddressIds.length}
                </div>
              )}
            </Form.Item>
          )}

          <Form.Item label="Период" required>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
              }}
              format="DD.MM.YYYY"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="Инженер (фильтр, необязательно)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Все инженеры"
              value={engineerId || undefined}
              onChange={(v) => setEngineerId(v || '')}
              options={engineers.map((e: any) => ({ value: e.id, label: e.fullName }))}
            />
          </Form.Item>

          <Form.Item label="Копия акта с подписью (необязательно, макс. 10 файлов)">
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #d9d9d9',
                borderRadius: 8,
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#fafafa',
                transition: 'border-color 0.2s',
              }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#1677ff'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = '#d9d9d9'; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#d9d9d9';
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                  const event = { target: { files } } as React.ChangeEvent<HTMLInputElement>;
                  handleAddScans(event);
                }
              }}
            >
              <InboxOutlined style={{ fontSize: 32, color: '#1677ff' }} />
              <div style={{ marginTop: 8, color: '#666' }}>Перетащите файлы сюда или нажмите для выбора</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>JPG, PNG, PDF. Макс. 10 файлов, 50 МБ</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              style={{ display: 'none' }}
              onChange={handleAddScans}
            />
          </Form.Item>

          {scanFiles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {scanFiles.map(f => (
                <div key={f.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#f5f5f5', borderRadius: 4, marginBottom: 4 }}>
                  <span><PaperClipOutlined /> {f.name} ({formatSize(f.size)})</span>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeScan(f.uid)} />
                </div>
              ))}
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                Всего: {scanFiles.length} файл(ов), {formatSize(getTotalScanSize())}
              </div>
            </div>
          )}

          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={handleGenerate}
            loading={loading}
            size="large"
            block
            disabled={reportType === 'objects' && selectedAddressIds.length === 0}
          >
            СФОРМИРОВАТЬ И СКАЧАТЬ PDF
          </Button>
        </Form>
      </Card>
    </div>
  );
}
