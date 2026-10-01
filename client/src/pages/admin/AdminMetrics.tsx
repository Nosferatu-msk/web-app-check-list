import { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Segmented, Table, Tag, Spin, Typography } from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  RiseOutlined,
  FallOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { api } from '../../api/client';
import dayjs from 'dayjs';

const { Title } = Typography;

const ROLE_LABELS: Record<string, string> = {
  engineer: 'Инженеры',
  tm: 'ТМ',
  admin: 'Администраторы',
  engineer_mtr: 'Инженеры МТР',
  tm_mtr: 'ТМ МТР',
};

const ROLE_COLORS: Record<string, string> = {
  engineer: '#059669',
  tm: '#2563eb',
  admin: '#dc2626',
  engineer_mtr: '#0891b2',
  tm_mtr: '#7c3aed',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Обновление',
  delete: 'Удаление',
  complete: 'Завершение',
  upload_photo: 'Загрузка фото',
  delete_photo: 'Удаление фото',
  generate_report: 'Генерация отчёта',
  generate_unified_report: 'Сводный отчёт',
  send_report: 'Отправка отчёта',
  assigned: 'Назначение',
  reassign: 'Переназначение',
  assign_engineer: 'Назначение инженера',
  approve: 'Согласование',
  reject: 'Отклонение',
  import_requests: 'Импорт заявок',
  batch_update_anomalies: 'Пакетная обработка аномалий',
};

const BAR_COLORS = ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#dc2626', '#d97706', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

interface MetricsData {
  dau: number;
  wau: number;
  mau: number;
  avgDau: number;
  retention: number;
  dauByDay: { date: string; count: number }[];
  byRole: { role: string; count: number }[];
  topActions: { action: string; count: number }[];
  period: number;
}

export default function AdminMetrics() {
  const [period, setPeriod] = useState<number>(30);
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.adminGet('metrics', { period: String(p) });
      setData(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period); }, [period]);

  const roleTotal = data?.byRole.reduce((s, r) => s + r.count, 0) || 0;
  const actionTotal = data?.topActions.reduce((s, a) => s + a.count, 0) || 0;

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Продуктовые метрики</Title>
        <Segmented
          value={period}
          onChange={(v) => setPeriod(Number(v))}
          options={[
            { label: '7 дней', value: 7 },
            { label: '30 дней', value: 30 },
            { label: '90 дней', value: 90 },
          ]}
        />
      </div>

      {loading || !data ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* Карточки метрик */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="DAU (сегодня)"
                  value={data.dau}
                  prefix={<UserOutlined />}
                  suffix={<span style={{ fontSize: 12, color: '#888' }}>сред. {data.avgDau}</span>}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="WAU (7 дней)"
                  value={data.wau}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title={`MAU (${data.period} дн.)`}
                  value={data.mau}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="Retention"
                  value={data.retention}
                  suffix="%"
                  prefix={data.retention >= 50 ? <RiseOutlined style={{ color: '#059669' }} /> : <FallOutlined style={{ color: '#dc2626' }} />}
                />
              </Card>
            </Col>
          </Row>

          {/* График DAU по дням */}
          <Card title="DAU по дням" size="small" style={{ marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.dauByDay.map(d => ({
                date: dayjs(d.date).format('DD.MM'),
                count: d.count,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  formatter={(value) => [`${value} польз.`, 'DAU']}
                />
                <Line type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* По ролям и действиям */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={10}>
              <Card title="Активность по ролям" size="small">
                {data.byRole.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>Нет данных</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.byRole} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="role" type="category" tick={{ fontSize: 12 }} width={100}
                          tickFormatter={(v: string) => ROLE_LABELS[v] || v}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 13 }}
                          formatter={(value) => [`${value} польз.`, 'Активные']}
                          labelFormatter={(v) => ROLE_LABELS[String(v)] || String(v)}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {data.byRole.map((entry, i) => (
                            <Cell key={entry.role} fill={ROLE_COLORS[entry.role] || BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 8 }}>
                      {data.byRole.map((r, i) => (
                        <div key={r.role} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < data.byRole.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                          <span>
                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: ROLE_COLORS[r.role] || BAR_COLORS[i], marginRight: 8 }} />
                            {ROLE_LABELS[r.role] || r.role}
                          </span>
                          <span style={{ color: '#666' }}>
                            {r.count} <span style={{ color: '#999', fontSize: 12 }}>({roleTotal > 0 ? Math.round(r.count / roleTotal * 100) : 0}%)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Card title="Топ-10 действий" size="small">
                {data.topActions.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>Нет данных</div>
                ) : (
                  <Table
                    dataSource={data.topActions}
                    rowKey="action"
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: 'Действие',
                        dataIndex: 'action',
                        render: (v: string) => <Tag color="blue">{ACTION_LABELS[v] || v}</Tag>,
                      },
                      {
                        title: 'Количество',
                        dataIndex: 'count',
                        width: 120,
                        align: 'right',
                        render: (v: number) => (
                          <span>
                            <strong>{v}</strong>
                            <span style={{ color: '#999', fontSize: 12, marginLeft: 6 }}>
                              ({actionTotal > 0 ? Math.round(v / actionTotal * 100) : 0}%)
                            </span>
                          </span>
                        ),
                      },
                      {
                        title: '',
                        dataIndex: 'count',
                        width: '30%',
                        render: (v: number) => {
                          const max = data.topActions[0]?.count || 1;
                          return (
                            <div style={{ background: '#f5f5f5', borderRadius: 4, height: 16, overflow: 'hidden' }}>
                              <div style={{ background: '#059669', height: '100%', width: `${(v / max) * 100}%`, borderRadius: 4, transition: 'width 0.3s' }} />
                            </div>
                          );
                        },
                      },
                    ]}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
