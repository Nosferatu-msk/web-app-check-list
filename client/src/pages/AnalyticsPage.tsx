import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, Input, Select, Pagination, Spin, Empty, Button } from 'antd';
import { BarChartOutlined, WarningOutlined, CheckCircleOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileHeader from '../components/MobileHeader';
import type { AnalyticsVisitSummary, AnalyticsSummary } from '@shared/types';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<AnalyticsVisitSummary[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>({ totalVisits: 0, visitsWithAnomalies: 0, criticalCount: 0, warningCount: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('30d');
  const [severityFilter, setSeverityFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20', period });
      if (search) params.set('search', search);
      if (severityFilter) params.set('severity', severityFilter);
      const res = await api.getAnalyticsVisits(params.toString());
      setVisits(res.data || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, period, search, severityFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const severityColor = (v: AnalyticsVisitSummary) =>
    v.anomalyCount.critical > 0 ? '#DC2626' : '#D97706';

  const handleExport = () => {
    const rows = [['Дата', 'Инженер', 'Адрес', 'Код', 'Критические', 'Предупреждения', 'Статус']];
    for (const v of visits) {
      rows.push([v.date, v.engineer.name, v.address.fullAddress, v.visitCode,
        String(v.anomalyCount.critical), String(v.anomalyCount.warning), v.reviewStatus]);
    }
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (isMobile) {
    return (
      <div style={{ background: '#F8FAFC', minHeight: '100vh' }}>
        <MobileHeader title="Аналитика" showBack onBack={() => navigate(-1)} />
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {[{ l: 'Все', v: '' }, { l: 'Критические', v: 'critical' }, { l: 'Предупреждения', v: 'warning' }].map(f => (
            <span key={f.v} onClick={() => { setSeverityFilter(f.v); setPage(1); }} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #E2E8F0',
              fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer',
              background: severityFilter === f.v ? '#0F766E' : '#fff', color: severityFilter === f.v ? '#fff' : '#475569',
              borderColor: severityFilter === f.v ? '#0F766E' : '#E2E8F0',
            }}>{f.l}</span>
          ))}
        </div>
        <div style={{ padding: '8px 16px', display: 'flex', gap: 8 }}>
          <Card size="small" style={{ flex: 1, borderRadius: 12, textAlign: 'center' }}>
            <Statistic value={summary.totalVisits} valueStyle={{ fontSize: 20, fontWeight: 700 }} />
            <div style={{ fontSize: 11, color: '#475569' }}>Визитов</div>
          </Card>
          <Card size="small" style={{ flex: 1, borderRadius: 12, textAlign: 'center' }}>
            <Statistic value={summary.criticalCount} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }} />
            <div style={{ fontSize: 11, color: '#475569' }}>Крит.</div>
          </Card>
          <Card size="small" style={{ flex: 1, borderRadius: 12, textAlign: 'center' }}>
            <Statistic value={summary.warningCount} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#D97706' }} />
            <div style={{ fontSize: 11, color: '#475569' }}>Предупр.</div>
          </Card>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          {loading ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : visits.length === 0 ? (
            <Empty description="Нет визитов с отклонениями" />
          ) : visits.map(v => (
            <div key={v.visitId} onClick={() => navigate(`/analytics/${v.visitId}`)}
              style={{ border: '1px solid #E2E8F0', borderLeft: `3px solid ${severityColor(v)}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{v.engineer.name}</span>
                <span style={{ fontSize: 12, color: '#475569' }}>{v.date}</span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{v.address.fullAddress}</div>
              <span style={{ fontSize: 11, color: '#0369A1', background: '#E0F2FE', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>{v.visitCode}</span>
              <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                {v.anomalyCount.critical > 0 && (
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#FEE2E2', color: '#DC2626' }}>
                    ● {v.anomalyCount.critical}
                  </span>
                )}
                {v.anomalyCount.warning > 0 && (
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#FEF3C7', color: '#92400E' }}>
                    ● {v.anomalyCount.warning}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ padding: '20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChartOutlined style={{ color: '#0F766E' }} /> Аналитика визитов
            </h1>
            <p style={{ fontSize: 13, color: '#475569', margin: '2px 0 0' }}>Визиты с отклонениями по результатам автоматических проверок</p>
          </div>
        </div>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderRadius: 12 }}>
              <Statistic title="Визитов за период" value={summary.totalVisits} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderRadius: 12 }}>
              <Statistic title="Критические" value={summary.criticalCount} valueStyle={{ color: '#DC2626' }} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderRadius: 12 }}>
              <Statistic title="Предупреждения" value={summary.warningCount} valueStyle={{ color: '#D97706' }} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderRadius: 12 }}>
              <Statistic title="Без отклонений" value={summary.totalVisits - summary.visitsWithAnomalies} valueStyle={{ color: '#059669' }} />
            </Card>
          </Col>
        </Row>

        <Card size="small" style={{ borderRadius: 12, marginBottom: 16, background: '#F8FAFC' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input
              placeholder="Поиск по инженеру или адресу..."
              prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 240 }}
              allowClear
            />
            <Select value={period} onChange={v => { setPeriod(v); setPage(1); }} style={{ width: 180 }}
              options={[{ value: '7d', label: 'Последние 7 дней' }, { value: '30d', label: 'Последние 30 дней' }, { value: '90d', label: 'Последние 90 дней' }]}
            />
          </div>
        </Card>

        {loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : visits.length === 0 ? (
          <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
            <Empty description="Нет визитов с отклонениями" />
          </Card>
        ) : (
          <>
            {visits.map(v => (
              <Card key={v.visitId} size="small" style={{ borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${severityColor(v)}`, cursor: 'pointer' }}
                onClick={() => navigate(`/analytics/${v.visitId}`)}
                styles={{ body: { padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 } }}>
                <div style={{ minWidth: 48 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1 }}>{v.date.split('-')[2]}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{['янн','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][parseInt(v.date.split('-')[1]) - 1]}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{v.engineer.name}</div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{v.address.fullAddress}</div>
                  <span style={{ fontSize: 11, color: '#0369A1', background: '#E0F2FE', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>{v.visitCode}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {v.anomalyCount.critical > 0 && (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#FEE2E2', color: '#DC2626' }}>
                      ● {v.anomalyCount.critical}
                    </span>
                  )}
                  {v.anomalyCount.warning > 0 && (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#FEF3C7', color: '#92400E' }}>
                      ● {v.anomalyCount.warning}
                    </span>
                  )}
                </div>
                <span style={{ color: '#94A3B8', fontSize: 16 }}>›</span>
              </Card>
            ))}
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Pagination current={page} total={total} pageSize={20} onChange={setPage} showSizeChanger={false} />
            </div>
          </>
        )}

        <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ marginBottom: 24 }}>
          Экспорт в CSV
        </Button>
      </div>
    </div>
  );
}
