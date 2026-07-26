import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Tag, Space, Select, Card, Modal, Upload, App, Tabs, Input, Badge } from 'antd';
import { UploadOutlined, UserAddOutlined, UserDeleteOutlined, LinkOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { IMPORT_STATUS_LABELS, VISIT_STATUS_LABELS } from '../../../shared/types/index';
import NotificationBell from '../components/NotificationBell';
import MobileHeader from '../components/MobileHeader';
import { useIsMobile } from '../hooks/useIsMobile';

const IMPORT_STATUS_COLORS: Record<string, string> = {
  new: 'default',
  matched: 'processing',
  created: 'success',
  error: 'error',
  skipped: 'warning',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [importStatusFilter, setImportStatusFilter] = useState<string>('');
  const [engineers, setEngineers] = useState<any[]>([]);
  const [assignModal, setAssignModal] = useState<{ visible: boolean; requestId?: string; visitId?: string }>({ visible: false });
  const [selectedEngineer, setSelectedEngineer] = useState<string>('');
  const [bindModal, setBindModal] = useState<{ visible: boolean; requestId?: string }>({ visible: false });
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message, modal } = App.useApp();

  const isTm = user?.role === 'tm';
  const isAdmin = user?.role === 'admin';
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, pageSize };
      if (importStatusFilter) params.importStatus = importStatusFilter;
      const res = await api.getRequests(params);
      setRequests(res.data || []);
      setTotal(res.total || 0);

      if (isTm || isAdmin) {
        const users = await api.getEngineers();
        setEngineers((users || []).filter((u: any) => u.isActive !== false));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, pageSize, importStatusFilter, isTm, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleImport = async (file: File) => {
    try {
      setImporting(true);
      const result = await api.importRequests(file);
      if (result.status === 'processing') {
        message.info('Импорт запущен в фоновом режиме');
        // Polling
        const poll = setInterval(async () => {
          const status = await api.getImportStatus(result.importLogId);
          if (status.status === 'completed' || status.status === 'error') {
            clearInterval(poll);
            setImporting(false);
            if (status.status === 'completed') {
              message.success(`Импорт завершён. Создано: ${status.successRows}, ошибок: ${status.errorRows}`);
            } else {
              message.error('Ошибка импорта');
            }
            load();
          }
        }, 2000);
      } else {
        message.success(`Импорт завершён. Создано: ${result.created}, ошибок: ${result.errors}`);
        setImporting(false);
        load();
      }
    } catch (err: any) {
      message.error(err.message);
      setImporting(false);
    }
    return false; // Prevent default upload
  };

  const handleAssign = async () => {
    if (!assignModal.requestId || !selectedEngineer) return;
    try {
      await api.assignEngineer(assignModal.requestId, selectedEngineer);
      message.success('Инженер назначен');
      setAssignModal({ visible: false });
      setSelectedEngineer('');
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleUnassign = (visitId: string, engineerId: string, requestId?: string) => {
    modal.confirm({
      title: 'Снять назначение?',
      content: 'Инженер будет снят с заявки.',
      okText: 'Снять',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.unassignEngineer(visitId, engineerId, requestId);
          message.success('Назначение снято');
          load();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleBind = async () => {
    if (!bindModal.requestId || !selectedAddress) return;
    try {
      await api.bindRequest(bindModal.requestId, selectedAddress);
      message.success('Заявка привязана к объекту');
      setBindModal({ visible: false });
      setSelectedAddress('');
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const openBindModal = async (requestId: string) => {
    setBindModal({ visible: true, requestId });
    const res = await api.adminGet('addresses', { page: '1', pageSize: '1000' });
    setAddresses(res.data || []);
  };

  const columns: ColumnsType<any> = [
    {
      title: '№ заявки',
      dataIndex: 'externalRequestId',
      key: 'externalRequestId',
      width: 150,
    },
    {
      title: 'Статус',
      dataIndex: 'importStatus',
      key: 'importStatus',
      width: 120,
      render: (status: string) => (
        <Tag color={IMPORT_STATUS_COLORS[status]}>{IMPORT_STATUS_LABELS[status as keyof typeof IMPORT_STATUS_LABELS] || status}</Tag>
      ),
    },
    {
      title: 'Вид оборудования',
      key: 'equipment',
      width: 200,
      render: (_: any, record: any) => record.equipmentType?.name || '-',
    },
    {
      title: 'Код объекта',
      dataIndex: 'objectCode',
      key: 'objectCode',
      width: 120,
    },
    {
      title: 'Адрес',
      key: 'address',
      width: 300,
      render: (_: any, record: any) => record.matchedAddress?.fullAddress || record.addressRaw || '-',
    },
    {
      title: 'Визит',
      key: 'visit',
      width: 150,
      render: (_: any, record: any) => {
        if (!record.visit) return '-';
        const statusLabel = VISIT_STATUS_LABELS[record.visit.status as keyof typeof VISIT_STATUS_LABELS] || record.visit.status;
        return (
          <Space direction="vertical" size={0}>
            <Tag>{statusLabel}</Tag>
            {record.visit.isMultiSpecialist && <Tag color="purple">Мультиспец.</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Инженеры',
      key: 'engineers',
      width: 200,
      render: (_: any, record: any) => {
        if (!record.visit?.visitEngineers || record.visit.visitEngineers.length === 0) {
          return <Tag color="orange">Не назначен</Tag>;
        }
        return (
          <Space direction="vertical" size={2}>
            {record.visit.visitEngineers.map((ve: any) => (
              <Space key={ve.id}>
                <span>{ve.engineer?.fullName}</span>
                {ve.isPrimary && <Badge status="success" text="основной" />}
              </Space>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_: any, record: any) => {
        if (record.importStatus === 'error') {
          return (
            <Button size="small" icon={<LinkOutlined />} onClick={() => openBindModal(record.id)}>
              Привязать
            </Button>
          );
        }
        if (!record.visit) return null;
        
        const hasEngineers = record.visit.visitEngineers?.length > 0;
        const isISZH = record.equipmentType?.name?.toLowerCase().includes('исж объекта');
        const canAssignMore = isISZH || record.visit.isMultiSpecialist || !hasEngineers;

        return (
          <Space>
            {canAssignMore && (
              <Button
                size="small"
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => setAssignModal({ visible: true, requestId: record.id, visitId: record.visit.id })}
              >
                Назначить
              </Button>
            )}
            {hasEngineers && record.visit.visitEngineers.map((ve: any) => (
              <Button
                key={ve.id}
                size="small"
                danger
                icon={<UserDeleteOutlined />}
                onClick={() => handleUnassign(record.visit.id, ve.engineerId, record.id)}
              >
                Снять {ve.engineer?.fullName?.split(' ')[0]}
              </Button>
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-container">
      {isMobile && (
        <MobileHeader
          title="Заявки"
          showBack
          onBack={() => navigate('/')}
        />
      )}

      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="page-title" style={{ margin: 0, fontSize: 16 }}>Заявки</div>
          <Space>
            <NotificationBell />
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Назад</Button>
            <Button onClick={() => { logout(); navigate('/login'); }}>Выход</Button>
          </Space>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(isTm || isAdmin) && (
          <Upload
            accept=".xlsx"
            showUploadList={false}
            beforeUpload={handleImport}
            disabled={importing}
          >
            <Button icon={<UploadOutlined />} loading={importing}>
              Импорт Excel
            </Button>
          </Upload>
        )}
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="Статус импорта"
            style={{ width: 200 }}
            allowClear
            value={importStatusFilter || undefined}
            onChange={(v) => { setImportStatusFilter(v || ''); setPage(1); }}
          >
            {Object.entries(IMPORT_STATUS_LABELS).map(([key, label]) => (
              <Select.Option key={key} value={key}>{label}</Select.Option>
            ))}
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* Модальное окно назначения инженера */}
      <Modal
        title="Назначить инженера"
        open={assignModal.visible}
        onOk={handleAssign}
        onCancel={() => { setAssignModal({ visible: false }); setSelectedEngineer(''); }}
        okText="Назначить"
        cancelText="Отмена"
      >
        <Select
          placeholder="Выберите инженера"
          style={{ width: '100%' }}
          value={selectedEngineer || undefined}
          onChange={setSelectedEngineer}
          showSearch
          optionFilterProp="children"
        >
          {engineers.map((eng) => (
            <Select.Option key={eng.id} value={eng.id}>
              {eng.fullName} ({eng.email})
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* Модальное окно привязки к объекту */}
      <Modal
        title="Привязать заявку к объекту"
        open={bindModal.visible}
        onOk={handleBind}
        onCancel={() => { setBindModal({ visible: false }); setSelectedAddress(''); }}
        okText="Привязать"
        cancelText="Отмена"
      >
        <Select
          placeholder="Выберите объект"
          style={{ width: '100%' }}
          value={selectedAddress || undefined}
          onChange={setSelectedAddress}
          showSearch
          optionFilterProp="children"
        >
          {addresses.map((addr) => (
            <Select.Option key={addr.id} value={addr.id}>
              {addr.fullAddress} {addr.objectCode ? `(${addr.objectCode})` : ''}
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
}
