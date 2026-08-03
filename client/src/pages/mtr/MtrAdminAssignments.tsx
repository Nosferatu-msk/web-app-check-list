import { useEffect, useState, useCallback } from 'react';
import { Button, Table, Space, Input, App, Modal, Select, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import { MtrTmObject, MtrTmEngineer } from '../../../../shared/types/index';

export default function MtrAdminAssignments() {
  const { message, modal } = App.useApp();

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Привязки МТР</h2>
      <Tabs
        defaultActiveKey="objects"
        items={[
          { key: 'objects', label: 'Объекты', children: <TmObjectsTab /> },
          { key: 'engineers', label: 'Инженеры', children: <TmEngineersTab /> },
        ]}
      />
    </div>
  );
}

// ─── Tab: Объекты ТМ МТР ──────────────────────────────────────

function TmObjectsTab() {
  const [objects, setObjects] = useState<MtrTmObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [tmUsers, setTmUsers] = useState<any[]>([]);
  const [selectedTm, setSelectedTm] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newTmId, setNewTmId] = useState<string>('');
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { message, modal } = App.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedTm) params.tm_id = selectedTm;
      const res = await api.mtr.getTmObjects(params);
      setObjects(res.data || []);
    } catch {
      message.error('Ошибка загрузки');
    }
    setLoading(false);
  }, [selectedTm, message]);

  const loadTmUsers = useCallback(async () => {
    try {
      const res = await api.adminGet('users', { role: 'tm_mtr' });
      setTmUsers(res.data || res || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTmUsers(); }, [loadTmUsers]);

  useEffect(() => {
    if (!addressSearch || addressSearch.length < 2) {
      setAddressResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await api.searchAddresses(addressSearch);
        setAddressResults(results || []);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [addressSearch]);

  const handleCreate = async () => {
    if (!newTmId) { message.warning('Выберите ТМ МТР'); return; }
    if (!selectedAddress) { message.warning('Выберите адрес'); return; }
    setSaving(true);
    try {
      await api.mtr.createTmObject({ tmId: newTmId, addressId: selectedAddress.id });
      message.success('Привязка создана');
      setModalOpen(false);
      setNewTmId('');
      setSelectedAddress(null);
      setAddressSearch('');
      await load();
    } catch (err: any) {
      message.error(err.message);
    }
    setSaving(false);
  };

  const handleDelete = (record: MtrTmObject) => {
    modal.confirm({
      title: 'Удалить привязку?',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.mtr.deleteTmObject(record.id);
          message.success('Привязка удалена');
          await load();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const columns = [
    {
      title: 'ТМ МТР',
      key: 'tm',
      render: (_: any, record: MtrTmObject) => record.tm?.fullName || '—',
    },
    {
      title: 'Адрес',
      key: 'address',
      ellipsis: true,
      render: (_: any, record: MtrTmObject) => record.address?.fullAddress || '—',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 80,
      render: (_: any, record: MtrTmObject) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Select
          placeholder="Фильтр по ТМ МТР"
          allowClear
          style={{ width: 250 }}
          value={selectedTm || undefined}
          onChange={(v) => setSelectedTm(v || '')}
          options={tmUsers.map((u) => ({ value: u.id, label: u.fullName }))}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModalOpen(true); setNewTmId(selectedTm); }}>
          Добавить привязку
        </Button>
      </div>

      <Table
        dataSource={objects}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="Новая привязка объекта"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setSelectedAddress(null); setAddressSearch(''); }}
        onOk={handleCreate}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={saving}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>ТМ МТР *</div>
          <Select
            placeholder="Выберите ТМ МТР"
            style={{ width: '100%' }}
            value={newTmId || undefined}
            onChange={setNewTmId}
            options={tmUsers.map((u) => ({ value: u.id, label: u.fullName }))}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Адрес *</div>
          <Input
            placeholder="Начните вводить адрес..."
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
          />
          {selectedAddress && (
            <div style={{ marginTop: 8, padding: 8, background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
              {selectedAddress.fullAddress}
              <Button type="link" size="small" onClick={() => { setSelectedAddress(null); setAddressSearch(''); }}>Изменить</Button>
            </div>
          )}
          {addressResults.length > 0 && !selectedAddress && (
            <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              {addressResults.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => { setSelectedAddress(addr); setAddressSearch(addr.fullAddress); setAddressResults([]); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                >
                  {addr.fullAddress}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── Tab: Инженеры ТМ МТР ─────────────────────────────────────

function TmEngineersTab() {
  const [assignments, setAssignments] = useState<MtrTmEngineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tmUsers, setTmUsers] = useState<any[]>([]);
  const [engineerUsers, setEngineerUsers] = useState<any[]>([]);
  const [selectedTm, setSelectedTm] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newTmId, setNewTmId] = useState<string>('');
  const [newEngineerId, setNewEngineerId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const { message, modal } = App.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedTm) params.tm_id = selectedTm;
      const res = await api.mtr.getTmEngineersAdmin(params);
      setAssignments(res.data || []);
    } catch {
      message.error('Ошибка загрузки');
    }
    setLoading(false);
  }, [selectedTm, message]);

  const loadUsers = useCallback(async () => {
    try {
      const [tmRes, engRes] = await Promise.all([
        api.adminGet('users', { role: 'tm_mtr' }),
        api.adminGet('users', { role: 'engineer_mtr' }),
      ]);
      setTmUsers(tmRes.data || tmRes || []);
      setEngineerUsers(engRes.data || engRes || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    if (!newTmId) { message.warning('Выберите ТМ МТР'); return; }
    if (!newEngineerId) { message.warning('Выберите инженера'); return; }
    setSaving(true);
    try {
      await api.mtr.createTmEngineer({ tmId: newTmId, engineerId: newEngineerId });
      message.success('Привязка создана');
      setModalOpen(false);
      setNewTmId('');
      setNewEngineerId('');
      await load();
    } catch (err: any) {
      message.error(err.message);
    }
    setSaving(false);
  };

  const handleDelete = (record: MtrTmEngineer) => {
    modal.confirm({
      title: 'Удалить привязку?',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.mtr.deleteTmEngineer(record.id);
          message.success('Привязка удалена');
          await load();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const columns = [
    {
      title: 'ТМ МТР',
      key: 'tm',
      render: (_: any, record: MtrTmEngineer) => record.tm?.fullName || '—',
    },
    {
      title: 'Инженер МТР',
      key: 'engineer',
      render: (_: any, record: MtrTmEngineer) => record.engineer?.fullName || '—',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 80,
      render: (_: any, record: MtrTmEngineer) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Select
          placeholder="Фильтр по ТМ МТР"
          allowClear
          style={{ width: 250 }}
          value={selectedTm || undefined}
          onChange={(v) => setSelectedTm(v || '')}
          options={tmUsers.map((u) => ({ value: u.id, label: u.fullName }))}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModalOpen(true); setNewTmId(selectedTm); }}>
          Добавить привязку
        </Button>
      </div>

      <Table
        dataSource={assignments}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="Новая привязка инженера"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setNewTmId(''); setNewEngineerId(''); }}
        onOk={handleCreate}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={saving}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>ТМ МТР *</div>
          <Select
            placeholder="Выберите ТМ МТР"
            style={{ width: '100%' }}
            value={newTmId || undefined}
            onChange={setNewTmId}
            options={tmUsers.map((u) => ({ value: u.id, label: u.fullName }))}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Инженер МТР *</div>
          <Select
            placeholder="Выберите инженера МТР"
            style={{ width: '100%' }}
            value={newEngineerId || undefined}
            onChange={setNewEngineerId}
            options={engineerUsers.map((u) => ({ value: u.id, label: u.fullName }))}
          />
        </div>
      </Modal>
    </div>
  );
}
