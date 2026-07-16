import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tabs, Radio, DatePicker, Select, Button, Space, App, Form } from 'antd';
import { ArrowLeftOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { RangePicker } = DatePicker;

export default function SummaryReportPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { message } = App.useApp();
  const isTm = user?.role === 'tm';

  // Tab 1 — Summary report state
  const [period, setPeriod] = useState<string>('day');
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  const [engineerId, setEngineerId] = useState<string>('');
  const [engineers, setEngineers] = useState<any[]>([]);

  // Tab 2 — Object report state
  const [addressId, setAddressId] = useState<string>('');
  const [addressOptions, setAddressOptions] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);

  const loadEngineers = useCallback(async () => {
    try {
      const res = await fetch('/api/refs/engineers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      if (res.ok) {
        const list = await res.json();
        setEngineers(list);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadEngineers();
  }, [loadEngineers]);

  const searchAddresses = async (q: string) => {
    if (q.length >= 2) {
      try {
        const results = await api.searchAddresses(q);
        setAddressOptions(results);
      } catch { /* ignore */ }
    }
  };

  const handleSummaryDownload = async () => {
    try {
      await api.downloadSummaryReport({
        period,
        date: date ? date.format('YYYY-MM-DD') : undefined,
        engineerId: engineerId || undefined,
      });
      message.success('Отчёт скачан');
    } catch (err: any) {
      message.error(err.message || 'Ошибка формирования отчёта');
    }
  };

  const handleObjectDownload = async () => {
    if (!addressId) {
      message.warning('Выберите адрес объекта');
      return;
    }
    try {
      await api.downloadObjectReport({
        addressId,
        dateFrom: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        dateTo: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      });
      message.success('Отчёт скачан');
    } catch (err: any) {
      message.error(err.message || 'Ошибка формирования отчёта');
    }
  };

  const tabItems = [
    {
      key: 'summary',
      label: 'Сводный отчёт',
      children: (
        <Form layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item label="Период">
            <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)}>
              <Radio.Button value="day">День</Radio.Button>
              <Radio.Button value="week">Неделя</Radio.Button>
              <Radio.Button value="month">Месяц</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="Дата">
            <DatePicker
              value={date}
              onChange={(d) => d && setDate(d)}
              format="DD.MM.YYYY"
              style={{ width: '100%' }}
            />
          </Form.Item>

          {isTm ? (
            <Form.Item label="Инженер (фильтр)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Все инженеры"
                value={engineerId || undefined}
                onChange={(v) => setEngineerId(v || '')}
                options={engineers.map((e: any) => ({
                  value: e.id,
                  label: e.fullName,
                }))}
              />
            </Form.Item>
          ) : (
            <Form.Item label="Инженер (фильтр)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Все инженеры"
                value={engineerId || undefined}
                onChange={(v) => setEngineerId(v || '')}
                options={engineers.map((e: any) => ({
                  value: e.id,
                  label: e.fullName,
                }))}
              />
            </Form.Item>
          )}

          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={handleSummaryDownload}
            size="large"
            block
          >
            Сформировать отчёт
          </Button>
        </Form>
      ),
    },
    {
      key: 'object',
      label: 'Отчёт по объекту',
      children: (
        <Form layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item label="Адрес объекта" required>
            <Select
              showSearch
              filterOption={false}
              onSearch={searchAddresses}
              placeholder="Начните вводить адрес (мин. 2 символа)"
              value={addressId || undefined}
              onChange={(v) => setAddressId(v || '')}
              options={addressOptions.map((a: any) => ({
                value: a.id,
                label: a.fullAddress,
              }))}
              notFoundContent="Адрес не найден"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="Период">
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                }
              }}
              format="DD.MM.YYYY"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={handleObjectDownload}
            disabled={!addressId}
            size="large"
            block
          >
            Сформировать отчёт
          </Button>
        </Form>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="page-title">Сводные отчёты</div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          Назад
        </Button>
      </div>

      <Card>
        <Tabs items={tabItems} defaultActiveKey="summary" />
      </Card>
    </div>
  );
}
