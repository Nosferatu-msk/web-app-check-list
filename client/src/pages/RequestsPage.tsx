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

const EXECUTION_STATUS_LABELS: Record<string, string> = {
  not_assigned: 'Не назначена',
  assigned: 'Назначена',
  in_progress: 'В работе',
  completed: 'Завершена',
};

const EXECUTION_STATUS_COLORS: Record<string, string> = {
  not_assigned: 'default',
  assigned: 'processing',
  in_progress: 'warning',
  completed: 'success',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [executionStatusFilter, setExecutionStatusFilter] = useState<string>('');
  const [engineers, setEngineers] = useState<any[]>([]);
  const [assignModal, setAssignModal] = useState<{ visible: boolean; requestId?: string; visitId?: string }>({ visible: false });
  const [selectedEngineer, setSelectedEngineer] = useState<string>('');
  const [bindModal, setBindModal] = useState<{ visible: boolean; requestId?: string }>({ visible: false });
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('');
  const [engineerFilter, setEngineerFilter] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ row: number; externalRequestId: string; message: string }[]>([]);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
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
      if (executionStatusFilter) params.executionStatus = executionStatusFilter;
      if (sortField) { params.sortField = sortField; params.sortOrder = sortOrder; }
      if (engineerFilter) params.engineerId = engineerFilter;
      const res = await api.getRequests(params);
      setRequests(res.data || []);
      setTotal(res.total || 0);

      if (isTm || isAdmin) {
        const users = await api.getEngineers();
        setEngineers((users || []).filter((u: any) => u.isActive !== false));
      }
    } catch (err: any) {
      message.error('Ошибка загрузки заявок');
    }
    setLoading(false);
  }, [page, pageSize, executionStatusFilter, sortField, sortOrder, engineerFilter, isTm, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleImport = async (file: File) => {
    try {
      setImporting(true);
      // Шаг 1: предварительная валидация
      const validation = await api.validateRequestsFile(file);
      if (validation.errors && validation.errors.length > 0) {
        // Есть ошибки — показываем модальное окно
        setValidationErrors(validation.errors);
        setPendingImportFile(file);
        setImporting(false);
        return false;
      }
      // Ошибок нет — импортируем сразу
      await doImport(file);
    } catch (err: any) {
      message.error(err.message || 'Ошибка валидации файла');
      setImporting(false);
    }
    return false;
  };

  const doImport = async (file: File) => {
    try {
      setImporting(true);
      setValidationErrors([]);
      setPendingImportFile(null);
      const result = await api.importRequests(file);
      if (result.status === 'processing') {
        message.info('Импорт запущен в фоновом режиме');
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
        if (result.errors > 0 && result.errorDetails?.length > 0) {
          // Показываем детали ошибок после импорта
          setValidationErrors(result.errorDetails);
          setPendingImportFile(null);
          message.warning(`Импорт завершён. Создано: ${result.created}, ошибок: ${result.errors}`);
        } else {
          message.success(`Импорт завершён. Создано: ${result.created}`);
        }
        setImporting(false);
        load();
      }
    } catch (err: any) {
      message.error(err.message);
      setImporting(false);
    }
  };

  const handleConfirmImportWithErrors = () => {
    if (pendingImportFile) {
      Modal.confirm({
        title: 'Импортировать с ошибками?',
        content: `В файле есть ${validationErrors.length} строк с ошибками. Они будут пропущены. Остальные строки будут импортированы.`,
        okText: 'Импортировать',
        cancelText: 'Отмена',
        onOk: () => doImport(pendingImportFile),
      });
    }
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
      width: 130,
      ellipsis: true,
      sorter: true,
    },
    {
      title: 'Статус',
      key: 'executionStatus',
      width: 120,
      sorter: true,
      render: (_: any, record: any) => {
        const status = record.executionStatus || 'not_assigned';
        return (
          <Tag color={EXECUTION_STATUS_COLORS[status]}>
            {EXECUTION_STATUS_LABELS[status] || status}
          </Tag>
        );
      },
    },
    {
      title: 'Оборудование',
      key: 'equipment',
      width: 140,
      ellipsis: true,
      render: (_: any, record: any) => record.equipmentType?.name || '-',
    },
    {
      title: 'Код',
      dataIndex: 'objectCode',
      key: 'objectCode',
      width: 90,
      sorter: true,
    },
    {
      title: 'Адрес',
      key: 'address',
      width: 220,
      ellipsis: true,
      sorter: true,
      render: (_: any, record: any) => record.matchedAddress?.fullAddress || record.addressRaw || '-',
    },
    {
      title: 'Визит',
      key: 'visit',
      width: 120,
      render: (_: any, record: any) => {
        if (!record.visit) return '-';
        const statusLabel = VISIT_STATUS_LABELS[record.visit.status as keyof typeof VISIT_STATUS_LABELS] || record.visit.status;
        return (
          <Space direction="vertical" size={0}>
            <Tag>{statusLabel}</Tag>
            {record.visit.isMultiSpecialist && <Tag color="purple" style={{ fontSize: 11 }}>Мультиспец.</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Инженеры',
      key: 'engineers',
      width: 160,
      render: (_: any, record: any) => {
        if (!record.visit?.visitEngineers || record.visit.visitEngineers.length === 0) {
          return <Tag color="orange">Не назначен</Tag>;
        }
        return (
          <Space direction="vertical" size={2}>
            {record.visit.visitEngineers.map((ve: any) => (
              <Space key={ve.id} size={4}>
                <span style={{ fontSize: 13 }}>{ve.engineer?.fullName}</span>
                {ve.isPrimary && <Badge status="success" text={<span style={{ fontSize: 11 }}>осн.</span>} />}
              </Space>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
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

        return (
          <Space wrap size={4}>
            <Button
              size="small"
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setAssignModal({ visible: true, requestId: record.id, visitId: record.visit.id })}
            >
              +
            </Button>
            {hasEngineers && record.visit.visitEngineers.map((ve: any) => (
              <Button
                key={ve.id}
                size="small"
                danger
                icon={<UserDeleteOutlined />}
                title={`Снять: ${ve.engineer?.fullName}`}
                onClick={() => handleUnassign(record.visit.id, ve.engineerId, record.id)}
              />
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-container" style={!isMobile ? { maxWidth: 1400 } : undefined}>
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
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="Статус исполнения"
            style={{ width: 200 }}
            allowClear
            value={executionStatusFilter || undefined}
            onChange={(v) => { setExecutionStatusFilter(v || ''); setPage(1); }}
          >
            {Object.entries(EXECUTION_STATUS_LABELS).map(([key, label]) => (
              <Select.Option key={key} value={key}>{label}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="Инженер"
            style={{ width: 220 }}
            allowClear
            showSearch
            optionFilterProp="children"
            value={engineerFilter || undefined}
            onChange={(v) => { setEngineerFilter(v || ''); setPage(1); }}
          >
            {engineers.map((eng) => (
              <Select.Option key={eng.id} value={eng.id}>{eng.fullName}</Select.Option>
            ))}
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          onChange={(pagination, _filters, sorter: any) => {
            if (sorter && sorter.field) {
              setSortField(sorter.field as string);
              setSortOrder(sorter.order || '');
            } else {
              setSortField('');
              setSortOrder('');
            }
            if (pagination.current && pagination.current !== page) {
              setPage(pagination.current);
            }
            if (pagination.pageSize && pagination.pageSize !== pageSize) {
              setPageSize(pagination.pageSize);
              setPage(1);
            }
            if (pagination.current === page && pagination.pageSize === pageSize) {
              setPage(1);
            }
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: 'max-content' }}
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

      {/* Модальное окно ошибок валидации импорта */}
      <Modal
        title="Ошибки валидации файла"
        open={validationErrors.length > 0 && !pendingImportFile}
        onCancel={() => setValidationErrors([])}
        footer={[
          <Button key="close" onClick={() => setValidationErrors([])}>Закрыть</Button>,
        ]}
        width={700}
      >
        <p>Обнаружены ошибки в следующих строках:</p>
        <Table
          size="small"
          pagination={false}
          scroll={{ y: 300 }}
          dataSource={validationErrors}
          rowKey={(r) => `${r.row}-${r.externalRequestId}`}
          columns={[
            { title: 'Строка', dataIndex: 'row', width: 70 },
            { title: '№ заявки', dataIndex: 'externalRequestId', width: 160, render: (v: string) => v || '—' },
            { title: 'Ошибка', dataIndex: 'message' },
          ]}
        />
      </Modal>

      {/* Модальное окно подтверждения импорта с ошибками */}
      <Modal
        title="Обнаружены ошибки в файле"
        open={validationErrors.length > 0 && pendingImportFile !== null}
        onCancel={() => { setValidationErrors([]); setPendingImportFile(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setValidationErrors([]); setPendingImportFile(null); }}>Отмена</Button>,
          <Button key="import" type="primary" onClick={handleConfirmImportWithErrors}>Импортировать без ошибок</Button>,
        ]}
        width={700}
      >
        <p>В файле есть строки с ошибками ({validationErrors.length}). Они будут пропущены при импорте.</p>
        <Table
          size="small"
          pagination={false}
          scroll={{ y: 300 }}
          dataSource={validationErrors}
          rowKey={(r) => `${r.row}-${r.externalRequestId}`}
          columns={[
            { title: 'Строка', dataIndex: 'row', width: 70 },
            { title: '№ заявки', dataIndex: 'externalRequestId', width: 160, render: (v: string) => v || '—' },
            { title: 'Ошибка', dataIndex: 'message' },
          ]}
        />
      </Modal>
    </div>
  );
}
