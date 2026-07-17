import { useEffect, useState } from 'react';
import { Table, Select, DatePicker, Space, Tag, Button, App, Popconfirm } from 'antd';
import { DownloadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export default function AdminAuditLog() {
  const { message } = App.useApp();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const buildParams = (p = page, f = filters, ps: number | string = pageSize, dr = dateRange) => {
    const params: Record<string, string> = { page: String(p), pageSize: String(ps), ...f };
    if (dr) {
      params.date_from = dr[0].toISOString();
      params.date_to = dr[1].toISOString();
    }
    return params;
  };

  const load = async (p = page, f = filters, ps = pageSize, dr = dateRange) => {
    setLoading(true);
    const params = buildParams(p, f, ps, dr);
    const res = await api.adminGet('audit-log', params);
    setData(res.data || []);
    setTotal(res.total || 0);
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);

  const handleFilterChange = (key: string, value: string | undefined) => {
    const f = { ...filters };
    if (value) f[key] = value; else delete f[key];
    setFilters(f);
    setPage(1);
    load(1, f, pageSize, dateRange);
  };

  const handleDateChange = (dates: any) => {
    const range = dates ? [dates[0] as dayjs.Dayjs, dates[1] as dayjs.Dayjs] as [dayjs.Dayjs, dayjs.Dayjs] : null;
    setDateRange(range);
    setPage(1);
    load(1, filters, pageSize, range);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildParams(1, filters, String(total || 999999), dateRange);
      delete params.page;
      delete params.pageSize;
      const blob = await api.exportAuditLog(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${dayjs().format('YYYY-MM-DD')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('Файл выгружен');
    } catch {
      message.error('Ошибка выгрузки');
    } finally {
      setExporting(false);
    }
  };

  const handleClear = async () => {
    try {
      const params = buildParams(1, filters, '1', dateRange);
      delete params.page;
      delete params.pageSize;
      const res = await api.clearAuditLog(params);
      message.success(res.message || 'Записи удалены');
      load(1);
    } catch (e: any) {
      message.error(e?.message || 'Ошибка очистки');
    }
  };

  const columns = [
    { title: 'Дата', dataIndex: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm') },
    { title: 'Пользователь', key: 'user', render: (_: any, r: any) => r.user?.fullName || '—' },
    { title: 'Действие', dataIndex: 'action', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Сущность', dataIndex: 'entityType', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'ID', dataIndex: 'entityId', ellipsis: true, render: (v: string) => v?.slice(0, 8) || '—' },
    { title: 'IP', dataIndex: 'ipAddress' },
  ];

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Журнал аудита</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load(1)}>Обновить</Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>Выгрузить CSV</Button>
          <Popconfirm
            title="Очистить журнал аудита?"
            description={total > 0 ? `Будет удалено ${total} записей. Это действие необратимо.` : 'Нет записей для удаления.'}
            onConfirm={handleClear}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            disabled={total === 0}
          >
            <Button danger icon={<DeleteOutlined />} disabled={total === 0}>Очистить</Button>
          </Popconfirm>
        </Space>
      </div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select placeholder="Действие" allowClear style={{ width: 200 }}
          options={[
            { label: 'Вход', value: 'login' },
            { label: 'Создание', value: 'create' },
            { label: 'Обновление', value: 'update' },
            { label: 'Удаление', value: 'delete' },
            { label: 'Завершение', value: 'complete' },
            { label: 'Отправка отчёта', value: 'send_report' },
          ]}
          onChange={(v) => handleFilterChange('action', v)}
        />
        <RangePicker
          showTime={{ format: 'HH:mm' }}
          format="DD.MM.YYYY HH:mm"
          value={dateRange}
          onChange={handleDateChange}
          placeholder={['Дата с', 'Дата по']}
          presets={[
            { label: 'Сегодня', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
            { label: 'Вчера', value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] },
            { label: '7 дней', value: [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')] },
            { label: '30 дней', value: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')] },
          ]}
        />
      </Space>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total: number) => `Всего: ${total}`, onChange: (p, ps) => { setPage(p); if (ps !== pageSize) { setPageSize(ps); load(1, filters, ps, dateRange); } else { load(p, filters, pageSize, dateRange); } } }}
        size="small"
      />
    </div>
  );
}
