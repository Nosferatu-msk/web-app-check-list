import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Table, Tag, Space, Select, Card, Modal, Upload, App, Input, Badge,
  DatePicker, Tooltip, Popover, Segmented, Drawer, List, Empty, Dropdown,
} from 'antd';
import {
  UploadOutlined, UserAddOutlined, LinkOutlined, ArrowLeftOutlined,
  SearchOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  WarningOutlined, FilterOutlined, RightOutlined, CloseOutlined,
  EllipsisOutlined, SendOutlined, SyncOutlined, CheckCircleOutlined,
  MinusCircleOutlined, TeamOutlined, DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { VISIT_STATUS_LABELS } from '../../../shared/types/index';
import NotificationBell from '../components/NotificationBell';
import MobileHeader from '../components/MobileHeader';
import ContractBadge from '../components/ContractBadge';
import { useIsMobile } from '../hooks/useIsMobile';

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

const VISIT_STATUS_COLORS: Record<string, string> = {
  planned: 'cyan',
  not_started: 'default',
  in_progress: 'processing',
  completed: 'success',
  sent: 'blue',
  sent_by_engineer: 'blue',
  sent_by_tm: 'geekblue',
  corrected_by_tm: 'purple',
  awaiting_assignment: 'orange',
};

const VISIT_STATUS_ICONS: Record<string, React.ReactNode> = {
  planned: <ClockCircleOutlined />,
  not_started: <MinusCircleOutlined />,
  in_progress: <SyncOutlined spin />,
  completed: <CheckCircleOutlined />,
  sent: <SendOutlined />,
  awaiting_assignment: <ClockCircleOutlined />,
};

type TabKey = 'all' | 'not_assigned' | 'in_progress' | 'completed' | 'overdue';

const TAB_OPTIONS: { value: TabKey; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'not_assigned', label: 'Не назначенные' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершённые' },
  { value: 'overdue', label: 'Просроченные' },
];

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [engineers, setEngineers] = useState<any[]>([]);
  const [contracts, setContracts] = useState<{ id: string; number: string }[]>([]);

  // Фильтры
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [period, setPeriod] = useState<dayjs.Dayjs | null>(null);
  const [engineerFilter, setEngineerFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Сортировка
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  // Накопительный выбор
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Map<string, any>>(new Map());

  // Модалки
  const [assignModal, setAssignModal] = useState<{ visible: boolean; requestId?: string; visitId?: string }>({ visible: false });
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkEngineers, setBulkEngineers] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bindModal, setBindModal] = useState<{ visible: boolean; requestId?: string }>({ visible: false });
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  // Импорт
  const [importing, setImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ row: number; externalRequestId: string; message: string }[]>([]);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  // Мобильный drawer фильтров
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message, modal } = App.useApp();
  const isTm = user?.role === 'tm';
  const isAdmin = user?.role === 'admin';
  const isMobile = useIsMobile();

  // Debounce для поиска
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Загрузка справочников
  useEffect(() => {
    api.getContracts({ module: 'to' }).then(setContracts).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, pageSize };

      // Таб-фильтрация
      if (activeTab === 'not_assigned') params.executionStatus = 'not_assigned';
      else if (activeTab === 'in_progress') params.executionStatus = 'in_progress';
      else if (activeTab === 'completed') params.executionStatus = 'completed';
      else if (activeTab === 'overdue') params.isOverdue = 'true';

      if (sortField) { params.sortField = sortField; params.sortOrder = sortOrder; }
      if (engineerFilter) params.engineerId = engineerFilter;
      if (contractFilter) params.contractId = contractFilter;
      if (searchQuery) params.search = searchQuery;
      if (period) {
        params.periodMonth = String(period.month() + 1);
        params.periodYear = String(period.year());
      }

      const res = await api.getRequests(params);
      setRequests(res.data || []);
      setTotal(res.total || 0);

      // Обновляем selectedItems актуальными данными
      const newItems = new Map(selectedItems);
      (res.data || []).forEach((r: any) => {
        if (newItems.has(r.id)) newItems.set(r.id, r);
      });
      setSelectedItems(newItems);

      if (isTm || isAdmin) {
        const users = await api.getEngineers();
        setEngineers((users || []).filter((u: any) => u.isActive !== false));
      }
    } catch {
      message.error('Ошибка загрузки заявок');
    }
    setLoading(false);
  }, [page, pageSize, activeTab, sortField, sortOrder, engineerFilter, contractFilter, searchQuery, period, isTm, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // Сброс страницы при смене табов/фильтров
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
  };

  // ─── Импорт ─────────────────────────────────────────────
  const handleImport = async (file: File) => {
    try {
      setImporting(true);
      const validation = await api.validateRequestsFile(file);
      if (validation.errors?.length > 0) {
        setValidationErrors(validation.errors);
        setPendingImportFile(file);
        setImporting(false);
        return false;
      }
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
          setValidationErrors(result.errorDetails);
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
        content: `В файле есть ${validationErrors.length} строк с ошибками. Они будут пропущены.`,
        okText: 'Импортировать',
        cancelText: 'Отмена',
        onOk: () => doImport(pendingImportFile),
      });
    }
  };

  // ─── Назначение/снятие (одиночное) ──────────────────────
  const handleAssign = async () => {
    if (!assignModal.requestId || !bulkEngineers[0]) return;
    try {
      await api.assignEngineer(assignModal.requestId, bulkEngineers[0]);
      message.success('Инженер назначен');
      setAssignModal({ visible: false });
      setBulkEngineers([]);
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

  // ─── Массовое назначение ────────────────────────────────
  const handleBulkAssign = async () => {
    if (selectedKeys.size === 0 || bulkEngineers.length === 0) return;
    try {
      setBulkLoading(true);
      const result = await api.bulkAssignEngineers(Array.from(selectedKeys), bulkEngineers);
      const { totalAssigned, totalSkipped } = result.summary;
      if (totalSkipped > 0) {
        message.warning(`Назначено: ${totalAssigned}, пропущено: ${totalSkipped}`);
      } else {
        message.success(`Назначено: ${totalAssigned} назначений на ${selectedKeys.size} заявок`);
      }
      setBulkAssignOpen(false);
      setBulkEngineers([]);
      setSelectedKeys(new Set());
      setSelectedItems(new Map());
      load();
    } catch (err: any) {
      message.error(err.message);
    }
    setBulkLoading(false);
  };

  // ─── Привязка к объекту ─────────────────────────────────
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

  // ─── Выбор (накопительный) ──────────────────────────────
  const toggleSelection = (id: string, record?: any) => {
    const newKeys = new Set(selectedKeys);
    const newItems = new Map(selectedItems);
    if (newKeys.has(id)) {
      newKeys.delete(id);
      newItems.delete(id);
    } else {
      newKeys.add(id);
      if (record) newItems.set(id, record);
    }
    setSelectedKeys(newKeys);
    setSelectedItems(newItems);
  };

  const removeSelection = (id: string) => {
    const newKeys = new Set(selectedKeys);
    const newItems = new Map(selectedItems);
    newKeys.delete(id);
    newItems.delete(id);
    setSelectedKeys(newKeys);
    setSelectedItems(newItems);
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
    setSelectedItems(new Map());
  };

  // Активные фильтры (для chip-тегов)
  const activeFiltersCount = [contractFilter, period, engineerFilter].filter(Boolean).length;

  const clearFilter = (key: string) => {
    if (key === 'contract') { setContractFilter(''); setPage(1); }
    if (key === 'period') { setPeriod(null); setPage(1); }
    if (key === 'engineer') { setEngineerFilter(''); setPage(1); }
  };

  // ─── Колонки таблицы ────────────────────────────────────
  const columns: ColumnsType<any> = [
    {
      title: '№ заявки',
      key: 'requestInfo',
      width: 170,
      sorter: true,
      sortOrder: sortField === 'externalRequestId' ? (sortOrder === 'ascend' ? 'ascend' : 'descend') : undefined,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.externalRequestId || '—'}</div>
          {r.objectCode && <div style={{ fontSize: 12, color: '#888' }}>{r.objectCode}</div>}
        </div>
      ),
    },
    {
      title: 'Адрес',
      key: 'address',
      width: 250,
      ellipsis: true,
      sorter: true,
      sortOrder: sortField === 'address' ? (sortOrder === 'ascend' ? 'ascend' : 'descend') : undefined,
      render: (_: any, r: any) => r.matchedAddress?.fullAddress || r.addressRaw || '—',
    },
    {
      title: 'Оборудование',
      key: 'equipment',
      width: 140,
      ellipsis: true,
      render: (_: any, r: any) => r.equipmentType?.name || '—',
    },
    {
      title: 'Срок',
      key: 'deadline',
      width: 120,
      render: (_: any, r: any) => {
        if (!r.deadline) return '—';
        const dl = dayjs(r.deadline);
        const daysLeft = dl.diff(dayjs(), 'day');
        const isDone = ['completed', 'sent'].includes(r.executionStatus);
        if (isDone) return <Tag color="success" icon={<ClockCircleOutlined />}>{dl.format('DD.MM.YYYY')}</Tag>;
        if (daysLeft < 0) return <Tag color="error" icon={<WarningOutlined />}>{dl.format('DD.MM.YYYY')}</Tag>;
        if (daysLeft <= 5) return <Tag color="warning" icon={<ExclamationCircleOutlined />}>{dl.format('DD.MM.YYYY')}</Tag>;
        return <Tag color="success" icon={<ClockCircleOutlined />}>{dl.format('DD.MM.YYYY')}</Tag>;
      },
    },
    {
      title: 'Статус',
      key: 'statusEngineers',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'executionStatus' ? (sortOrder === 'ascend' ? 'ascend' : 'descend') : undefined,
      render: (_: any, r: any) => {
        const status = r.executionStatus || 'not_assigned';
        const engineers = getEngineersList(r);
        return (
          <div>
            <Tag color={EXECUTION_STATUS_COLORS[status]}>{EXECUTION_STATUS_LABELS[status] || status}</Tag>
            {engineers.length > 0 && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {engineers.map((e, i) => (
                  <span key={i}>
                    {i > 0 && ', '}{e.name}{e.isPrimary && <Badge status="success" text="" style={{ marginLeft: 2 }} />}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, r: any) => {
        if (r.importStatus === 'error') {
          return (
            <Button size="small" type="text" icon={<LinkOutlined />} onClick={() => openBindModal(r.id)} title="Привязать" />
          );
        }
        const items: any[] = [
          {
            key: 'assign',
            label: 'Назначить инженера',
            icon: <UserAddOutlined />,
            onClick: () => setAssignModal({ visible: true, requestId: r.id, visitId: r.visit?.id }),
          },
        ];
        if (r.visit?.visitEngineers?.length > 0) {
          r.visit.visitEngineers.forEach((ve: any) => {
            items.push({
              key: `unassign-${ve.id}`,
              label: `Снять: ${ve.engineer?.fullName}`,
              icon: <CloseOutlined />,
              danger: true,
              onClick: () => handleUnassign(r.visit.id, ve.engineerId, r.id),
            });
          });
        }
        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button size="small" type="text" icon={<EllipsisOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  // Извлечение списка инженеров из заявки
  const getEngineersList = (r: any): { name: string; isPrimary: boolean }[] => {
    const isISZHObject = r.equipmentType?.code === 'iszh_object';
    if (isISZHObject && r.visitRequests?.length > 0) {
      const map = new Map<string, { name: string; isPrimary: boolean }>();
      r.visitRequests.forEach((vr: any) => {
        vr.visit?.visitEngineers?.forEach((ve: any) => {
          if (ve.engineer?.fullName) map.set(ve.engineerId, { name: ve.engineer.fullName, isPrimary: ve.isPrimary });
        });
      });
      return Array.from(map.values());
    }
    if (!r.visit?.visitEngineers) return [];
    return r.visit.visitEngineers.map((ve: any) => ({
      name: ve.engineer?.fullName || '',
      isPrimary: ve.isPrimary,
    })).filter((e: any) => e.name);
  };

  // ─── Expandable Row ─────────────────────────────────────
  const expandedRowRender = (record: any) => {
    const visits = getVisitsForRequest(record);
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: visits.length > 0 ? 12 : 0 }}>
          {record.objectCode && (
            <div><span style={{ color: '#888', fontSize: 12 }}>Код:</span> <strong>{record.objectCode}</strong></div>
          )}
          <div>
            <span style={{ color: '#888', fontSize: 12 }}>Договор:</span>{' '}
            <ContractBadge contractNumber={record.contract?.number} />
          </div>
          <div><span style={{ color: '#888', fontSize: 12 }}>Создана:</span> {dayjs(record.createdAt).format('DD.MM.YYYY')}</div>
        </div>

        {visits.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#555' }}>
              Связанные визиты ({visits.length}):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {visits.map((v: any) => {
                const statusLabel = VISIT_STATUS_LABELS[v.status as keyof typeof VISIT_STATUS_LABELS] || v.status;
                const statusColor = VISIT_STATUS_COLORS[v.status] || 'default';
                const statusIcon = VISIT_STATUS_ICONS[v.status] || null;
                const engNames = v.visitEngineers?.map((ve: any) => ve.engineer?.fullName).filter(Boolean).join(', ') || 'Не назначен';
                return (
                  <div
                    key={v.id}
                    onClick={() => navigate(`/visit/${v.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                      background: '#fafafa', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid #f0f0f0', transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f5ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
                  >
                    <span style={{ color: '#888', fontSize: 12, minWidth: 70 }}>#{v.id.slice(-6)}</span>
                    <Tag color={statusColor} icon={statusIcon} style={{ margin: 0 }}>{statusLabel}</Tag>
                    <span style={{ fontSize: 13, flex: 1 }}>{engNames}</span>
                    <RightOutlined style={{ color: '#bbb', fontSize: 11 }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {visits.length === 0 && (
          <div style={{ color: '#999', fontSize: 13 }}>Визиты не созданы</div>
        )}
      </div>
    );
  };

  const getVisitsForRequest = (r: any): any[] => {
    const isISZHObject = r.equipmentType?.code === 'iszh_object';
    if (isISZHObject && r.visitRequests?.length > 0) {
      return r.visitRequests.map((vr: any) => vr.visit).filter(Boolean);
    }
    return r.visit ? [r.visit] : [];
  };

  // ─── Мобильные карточки ─────────────────────────────────
  const renderMobileCard = (r: any) => {
    const status = r.executionStatus || 'not_assigned';
    const engineers = getEngineersList(r);
    const address = r.matchedAddress?.fullAddress || r.addressRaw || '—';
    const isSelected = selectedKeys.has(r.id);

    return (
      <div
        key={r.id}
        style={{
          padding: 12, marginBottom: 8, borderRadius: 8,
          border: isSelected ? '2px solid #1677ff' : '1px solid #f0f0f0',
          background: isSelected ? '#e6f4ff' : '#fff',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div
            onClick={() => toggleSelection(r.id, r)}
            style={{
              width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 2,
              border: isSelected ? '2px solid #1677ff' : '2px solid #d9d9d9',
              background: isSelected ? '#1677ff' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {isSelected && <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{r.externalRequestId || '—'}</span>
              <Tag color={EXECUTION_STATUS_COLORS[status]} style={{ margin: 0, fontSize: 11 }}>
                {EXECUTION_STATUS_LABELS[status]}
              </Tag>
            </div>
            {r.objectCode && <Tag color="blue" style={{ marginTop: 4, fontSize: 11 }}>{r.objectCode}</Tag>}
            <div style={{ color: '#333', fontSize: 13, marginTop: 4, lineHeight: 1.3, wordBreak: 'break-word' }}>{address}</div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{r.equipmentType?.name || '—'}</div>
            {r.deadline && (
              <div style={{ fontSize: 12, marginTop: 2 }}>
                {(() => {
                  const dl = dayjs(r.deadline);
                  const daysLeft = dl.diff(dayjs(), 'day');
                  const isDone = ['completed', 'sent'].includes(status);
                  if (isDone) return <span style={{ color: '#52c41a' }}>✓ {dl.format('DD.MM.YYYY')}</span>;
                  if (daysLeft < 0) return <span style={{ color: '#ff4d4f' }}>⚠ Просрочена</span>;
                  if (daysLeft <= 5) return <span style={{ color: '#faad14' }}>⏳ {daysLeft} дн.</span>;
                  return <span style={{ color: '#888' }}>{dl.format('DD.MM.YYYY')}</span>;
                })()}
              </div>
            )}
            {engineers.length > 0 && (
              <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                {engineers.map((e, i) => <span key={i}>{i > 0 && ', '}{e.name}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Панель фильтров (Popover) ──────────────────────────
  const filtersContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
      <div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Договор</div>
        <Select
          placeholder="Все договоры"
          style={{ width: '100%' }}
          allowClear
          value={contractFilter || undefined}
          onChange={(v) => { setContractFilter(v || ''); setPage(1); }}
        >
          {contracts.map(c => <Select.Option key={c.id} value={c.id}>{c.number}</Select.Option>)}
        </Select>
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Период</div>
        <DatePicker
          picker="month"
          placeholder="Выберите месяц"
          value={period}
          onChange={(v) => { setPeriod(v); setPage(1); }}
          allowClear
          style={{ width: '100%' }}
        />
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Инженер</div>
        <Select
          placeholder="Все инженеры"
          style={{ width: '100%' }}
          allowClear
          showSearch
          optionFilterProp="children"
          value={engineerFilter || undefined}
          onChange={(v) => { setEngineerFilter(v || ''); setPage(1); }}
        >
          {engineers.map(eng => <Select.Option key={eng.id} value={eng.id}>{eng.fullName}</Select.Option>)}
        </Select>
      </div>
    </div>
  );

  // ─── Рендер ─────────────────────────────────────────────
  const selectedCount = selectedKeys.size;

  return (
    <div className="page-container" style={!isMobile ? { maxWidth: 1400 } : undefined}>
      {isMobile && (
        <MobileHeader title="Заявки" showBack onBack={() => navigate('/')} />
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

      {/* Импорт */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {(isTm || isAdmin) && (
          <Upload accept=".xlsx" showUploadList={false} beforeUpload={handleImport} disabled={importing}>
            <Button icon={<UploadOutlined />} loading={importing}>Импорт Excel</Button>
          </Upload>
        )}
      </div>

      {/* Табы */}
      <div style={{ marginBottom: 12 }}>
        <Segmented
          options={TAB_OPTIONS.map(t => ({ value: t.value, label: t.label }))}
          value={activeTab}
          onChange={(v) => handleTabChange(v as TabKey)}
          block
        />
      </div>

      {/* Поиск + фильтры */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          placeholder="Код, номер, адрес..."
          prefix={<SearchOutlined />}
          allowClear
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ width: isMobile ? '100%' : 250 }}
        />
        {isMobile ? (
          <Button icon={<FilterOutlined />} onClick={() => setMobileFiltersOpen(true)}>
            {activeFiltersCount > 0 ? `Фильтры (${activeFiltersCount})` : 'Фильтры'}
          </Button>
        ) : (
          <Popover
            content={filtersContent}
            title="Фильтры"
            trigger="click"
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
          >
            <Badge count={activeFiltersCount} size="small">
              <Button icon={<FilterOutlined />}>Фильтры</Button>
            </Badge>
          </Popover>
        )}
      </div>

      {/* Active filter chips */}
      {(contractFilter || period || engineerFilter) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {contractFilter && (
            <Tag closable onClose={() => clearFilter('contract')}>
              Договор: {contracts.find(c => c.id === contractFilter)?.number || contractFilter}
            </Tag>
          )}
          {period && (
            <Tag closable onClose={() => clearFilter('period')}>
              Период: {period.format('MM.YYYY')}
            </Tag>
          )}
          {engineerFilter && (
            <Tag closable onClose={() => clearFilter('engineer')}>
              Инженер: {engineers.find(e => e.id === engineerFilter)?.fullName || engineerFilter}
            </Tag>
          )}
        </div>
      )}

      {/* Контент: таблица или карточки */}
      <Card styles={{ body: { padding: isMobile ? 8 : 16 } }}>
        {isMobile ? (
          <>
            {requests.length === 0 && !loading ? (
              <Empty description="Нет заявок" />
            ) : (
              <List
                dataSource={requests}
                loading={loading}
                renderItem={(r: any) => <>{renderMobileCard(r)}</>}
              />
            )}
          </>
        ) : (
          <Table
            columns={columns}
            dataSource={requests}
            rowKey="id"
            loading={loading}
            size="small"
            rowSelection={{
              selectedRowKeys: Array.from(selectedKeys),
              onChange: (keys, rows) => {
                const newKeys = new Set(selectedKeys);
                const newItems = new Map(selectedItems);
                // Добавляем новые
                rows.forEach(r => {
                  newKeys.add(r.id);
                  newItems.set(r.id, r);
                });
                // Убираем те, что были на текущей странице но не в keys
                requests.forEach(r => {
                  if (!keys.includes(r.id)) {
                    // Только если был выбран — убираем
                    if (newKeys.has(r.id)) {
                      newKeys.delete(r.id);
                      newItems.delete(r.id);
                    }
                  }
                });
                setSelectedKeys(newKeys);
                setSelectedItems(newItems);
              },
            }}
            expandable={{
              expandedRowRender,
              rowExpandable: () => true,
            }}
            onChange={(pagination, _filters, sorter: any) => {
              if (sorter && sorter.field) {
                setSortField(sorter.field as string);
                setSortOrder(sorter.order || '');
              } else {
                setSortField('');
                setSortOrder('');
              }
              if (pagination.current && pagination.current !== page) setPage(pagination.current);
              if (pagination.pageSize && pagination.pageSize !== pageSize) {
                setPageSize(pagination.pageSize);
                setPage(1);
              }
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `Всего: ${t}`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            }}
          />
        )}
      </Card>

      {/* Панель массовых действий */}
      {selectedCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #f0f0f0',
          padding: '10px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 12, zIndex: 100,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
        }}>
          <TeamOutlined style={{ fontSize: 18, color: '#1677ff' }} />
          <span style={{ fontWeight: 500 }}>Выбрано: {selectedCount} заявок</span>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => { setBulkEngineers([]); setBulkAssignOpen(true); }}>
            Назначить инженеров
          </Button>
          <Button icon={<DeleteOutlined />} onClick={clearSelection}>Очистить</Button>
        </div>
      )}

      {/* Мобильный Drawer фильтров */}
      <Drawer
        title="Фильтры"
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        placement="right"
        width={300}
      >
        {filtersContent}
      </Drawer>

      {/* Модалка одиночного назначения */}
      <Modal
        title="Назначить инженера"
        open={assignModal.visible}
        onOk={handleAssign}
        onCancel={() => { setAssignModal({ visible: false }); setBulkEngineers([]); }}
        okText="Назначить"
        cancelText="Отмена"
      >
        <Select
          placeholder="Выберите инженера"
          style={{ width: '100%' }}
          value={bulkEngineers[0] || undefined}
          onChange={(v) => setBulkEngineers(v ? [v] : [])}
          showSearch
          optionFilterProp="children"
        >
          {engineers.map(eng => (
            <Select.Option key={eng.id} value={eng.id}>{eng.fullName} ({eng.email})</Select.Option>
          ))}
        </Select>
      </Modal>

      {/* Модалка массового назначения */}
      <Modal
        title={`Назначить инженеров на ${selectedCount} заявок`}
        open={bulkAssignOpen}
        onOk={handleBulkAssign}
        onCancel={() => { setBulkAssignOpen(false); setBulkEngineers([]); }}
        okText="Назначить"
        cancelText="Отмена"
        confirmLoading={bulkLoading}
        width={520}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>Выберите инженеров:</div>
          <Select
            mode="multiple"
            placeholder="Выберите инженеров"
            style={{ width: '100%' }}
            value={bulkEngineers}
            onChange={setBulkEngineers}
            showSearch
            optionFilterProp="children"
          >
            {engineers.map(eng => (
              <Select.Option key={eng.id} value={eng.id}>{eng.fullName}</Select.Option>
            ))}
          </Select>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>Заявки ({selectedCount}):</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
            {Array.from(selectedItems.values()).map((r: any) => (
              <div key={r.id} style={{ padding: '4px 0', borderBottom: '1px solid #fafafa', fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{r.externalRequestId}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>{r.matchedAddress?.fullAddress || r.addressRaw || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Модалка привязки к объекту */}
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
          {addresses.map(addr => (
            <Select.Option key={addr.id} value={addr.id}>
              {addr.fullAddress} {addr.objectCode ? `(${addr.objectCode})` : ''}
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* Модалка ошибок валидации */}
      <Modal
        title="Ошибки валидации файла"
        open={validationErrors.length > 0 && !pendingImportFile}
        onCancel={() => setValidationErrors([])}
        footer={[<Button key="close" onClick={() => setValidationErrors([])}>Закрыть</Button>]}
        width={700}
      >
        <p>Обнаружены ошибки в следующих строках:</p>
        <Table size="small" pagination={false} scroll={{ y: 300 }} dataSource={validationErrors}
          rowKey={(r) => `${r.row}-${r.externalRequestId}`}
          columns={[
            { title: 'Строка', dataIndex: 'row', width: 70 },
            { title: '№ заявки', dataIndex: 'externalRequestId', width: 160, render: (v: string) => v || '—' },
            { title: 'Ошибка', dataIndex: 'message' },
          ]}
        />
      </Modal>

      {/* Модалка подтверждения импорта с ошибками */}
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
        <p>В файле есть строки с ошибками ({validationErrors.length}). Они будут пропущены.</p>
        <Table size="small" pagination={false} scroll={{ y: 300 }} dataSource={validationErrors}
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
