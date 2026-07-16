import { useEffect, useState } from 'react';
import { Table, Select, DatePicker, Space, Tag } from 'antd';
import { api } from '../../api/client';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export default function AdminAuditLog() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = async (p = page, f = filters, ps = pageSize) => {
    setLoading(true);
    const params: any = { page: String(p), pageSize: String(ps), ...f };
    const res = await api.adminGet('audit-log', params);
    setData(res.data || []);
    setTotal(res.total || 0);
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);

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
      <h2>Журнал аудита</h2>
      <Space style={{ marginBottom: 16 }}>
        <Select placeholder="Действие" allowClear style={{ width: 200 }}
          options={[
            { label: 'Вход', value: 'login' },
            { label: 'Создание', value: 'create' },
            { label: 'Обновление', value: 'update' },
            { label: 'Удаление', value: 'delete' },
            { label: 'Завершение', value: 'complete' },
            { label: 'Отправка отчёта', value: 'send_report' },
          ]}
          onChange={(v) => { const f = { ...filters }; if (v) f.action = v; else delete f.action; setFilters(f); load(1, f); }}
        />
      </Space>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize: pageSize, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total: number) => `Всего: ${total}`, onChange: (p, ps) => { setPage(p); if (ps !== pageSize) { setPageSize(ps); load(1, filters, ps); } else { load(p, filters); } } }}
        size="small"
      />
    </div>
  );
}
