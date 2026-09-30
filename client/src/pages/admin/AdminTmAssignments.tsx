import { useEffect, useState } from 'react';
import { Table, Button, Select, Space, App, Popconfirm, Tabs, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

export default function AdminTmAssignments() {
  const { message } = App.useApp();
  const [tms, setTms] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [tmObjects, setTmObjects] = useState<any[]>([]);
  const [tmEngineers, setTmEngineers] = useState<any[]>([]);
  const [tmTeam, setTmTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedTm, setSelectedTm] = useState<string>('');
  const [newAddressId, setNewAddressId] = useState<string>('');
  const [newEngineerId, setNewEngineerId] = useState<string>('');
  const [newMemberTmId, setNewMemberTmId] = useState<string>('');
  const [selectedLeadTm, setSelectedLeadTm] = useState<string>('');

  const load = async () => {
    setLoading(true);
    const [users, tmObjs, tmEngrs, tmTeamData] = await Promise.all([
      api.adminGet('users'),
      api.adminGet('tm-objects'),
      api.adminGet('tm-engineers'),
      api.adminGet('tm-team'),
    ]);
    setTms((users || []).filter((u: any) => u.role === 'tm' && u.isActive));
    setEngineers((users || []).filter((u: any) => u.role === 'engineer' && u.isActive));
    setTmObjects(tmObjs || []);
    setTmEngineers(tmEngrs || []);
    setTmTeam(tmTeamData || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadAddresses = async (q: string) => {
    if (q.length < 2) { setAddresses([]); return; }
    const data = await api.adminGet('addresses/search', { q });
    setAddresses(data || []);
  };

  const handleAddObject = async () => {
    if (!selectedTm || !newAddressId) return;
    try {
      await api.adminCreate('tm-objects', { tmId: selectedTm, addressId: newAddressId });
      message.success('Объект привязан');
      setNewAddressId('');
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const handleAddEngineer = async () => {
    if (!selectedTm || !newEngineerId) return;
    try {
      await api.adminCreate('tm-engineers', { tmId: selectedTm, engineerId: newEngineerId });
      message.success('Инженер привязан');
      setNewEngineerId('');
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const handleDeleteObject = async (id: string) => {
    await api.adminDelete('tm-objects', id);
    message.success('Привязка удалена');
    load();
  };

  const handleDeleteEngineer = async (id: string) => {
    await api.adminDelete('tm-engineers', id);
    message.success('Привязка удалена');
    load();
  };

  const handleAddTeamMember = async () => {
    if (!selectedLeadTm || !newMemberTmId) return;
    try {
      await api.adminCreate('tm-team', { memberTmId: newMemberTmId, leadTmId: selectedLeadTm });
      message.success('ТМ добавлен в команду');
      setNewMemberTmId('');
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const handleDeleteTeamMember = async (memberTmId: string) => {
    await api.adminDelete('tm-team', memberTmId);
    message.success('ТМ удалён из команды');
    load();
  };

  const filteredObjects = selectedTm ? tmObjects.filter(o => o.tmId === selectedTm) : tmObjects;
  const filteredEngineers = selectedTm ? tmEngineers.filter(e => e.tmId === selectedTm) : tmEngineers;
  const filteredTeam = selectedLeadTm ? tmTeam.filter(t => t.leadTmId === selectedLeadTm) : tmTeam;
  const assignedMemberIds = tmTeam.map(t => t.memberTmId);

  return (
    <div>
      <div className="admin-page-header" style={{ marginBottom: 16 }}>
        <h2>Привязки территориальных менеджеров</h2>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Select
          allowClear
          showSearch
          placeholder="Выберите ТМ (или оставьте пустым для всех)"
          style={{ width: 300 }}
          value={selectedTm || undefined}
          onChange={(v) => setSelectedTm(v || '')}
          optionFilterProp="label"
          options={tms.map(t => ({ value: t.id, label: `${t.fullName} (${t.email})` }))}
        />
      </div>

      <Tabs items={[
        {
          key: 'objects',
          label: `Объекты (${filteredObjects.length})`,
          children: (
            <div>
              <Space style={{ marginBottom: 16 }}>
                <Select
                  showSearch
                  placeholder="Поиск адреса..."
                  style={{ width: 400 }}
                  value={newAddressId || undefined}
                  onChange={setNewAddressId}
                  onSearch={loadAddresses}
                  filterOption={false}
                  options={addresses.map((a: any) => ({ value: a.id, label: a.objectCode ? `[${a.objectCode}] ${a.fullAddress}` : a.fullAddress }))}
                  notFoundContent="Введите минимум 2 символа"
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddObject} disabled={!selectedTm || !newAddressId}>
                  Привязать
                </Button>
              </Space>
              <Table
                dataSource={filteredObjects}
                rowKey="id"
                loading={loading}
                pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total: number) => `Всего: ${total}` }}
                columns={[
                  { title: 'ТМ', render: (_: any, r: any) => r.tm?.fullName },
                  { title: 'Адрес', render: (_: any, r: any) => r.address?.objectCode ? `[${r.address.objectCode}] ${r.address.fullAddress}` : r.address?.fullAddress },
                  { title: 'Дата', render: (_: any, r: any) => new Date(r.createdAt).toLocaleDateString('ru-RU') },
                  { title: '', key: 'actions', width: 60, render: (_: any, r: any) => (
                    <Popconfirm title="Удалить привязку?" onConfirm={() => handleDeleteObject(r.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )},
                ]}
              />
            </div>
          ),
        },
        {
          key: 'engineers',
          label: `Инженеры (${filteredEngineers.length})`,
          children: (
            <div>
              <Space style={{ marginBottom: 16 }}>
                <Select
                  showSearch
                  placeholder="Выберите инженера"
                  style={{ width: 300 }}
                  value={newEngineerId || undefined}
                  onChange={setNewEngineerId}
                  optionFilterProp="label"
                  options={engineers.map(e => ({ value: e.id, label: `${e.fullName} (${e.email})` }))}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEngineer} disabled={!selectedTm || !newEngineerId}>
                  Привязать
                </Button>
              </Space>
              <Table
                dataSource={filteredEngineers}
                rowKey="id"
                loading={loading}
                pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total: number) => `Всего: ${total}` }}
                columns={[
                  { title: 'ТМ', render: (_: any, r: any) => r.tm?.fullName },
                  { title: 'Инженер', render: (_: any, r: any) => r.engineer?.fullName },
                  { title: 'Email', render: (_: any, r: any) => r.engineer?.email },
                  { title: 'Дата', render: (_: any, r: any) => new Date(r.createdAt).toLocaleDateString('ru-RU') },
                  { title: '', key: 'actions', width: 60, render: (_: any, r: any) => (
                    <Popconfirm title="Удалить привязку?" onConfirm={() => handleDeleteEngineer(r.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )},
                ]}
              />
            </div>
          ),
        },
        {
          key: 'team',
          label: <span><TeamOutlined /> Команды ({tmTeam.length})</span>,
          children: (
            <div>
              <Space style={{ marginBottom: 16 }}>
                <Select
                  showSearch
                  placeholder="Выберите лидера (основного ТМ)"
                  style={{ width: 300 }}
                  value={selectedLeadTm || undefined}
                  onChange={(v) => setSelectedLeadTm(v || '')}
                  optionFilterProp="label"
                  options={tms.map(t => ({ value: t.id, label: `${t.fullName} (${t.email})` }))}
                />
                <Select
                  showSearch
                  placeholder="Выберите ТМ2 (член команды)"
                  style={{ width: 300 }}
                  value={newMemberTmId || undefined}
                  onChange={setNewMemberTmId}
                  optionFilterProp="label"
                  options={tms
                    .filter(t => t.id !== selectedLeadTm && !assignedMemberIds.includes(t.id))
                    .map(t => ({ value: t.id, label: `${t.fullName} (${t.email})` }))}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTeamMember} disabled={!selectedLeadTm || !newMemberTmId}>
                  Добавить в команду
                </Button>
              </Space>
              <Table
                dataSource={filteredTeam}
                rowKey="memberTmId"
                loading={loading}
                pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total: number) => `Всего: ${total}` }}
                columns={[
                  { title: 'Лидер (ТМ)', render: (_: any, r: any) => r.leadTm?.fullName },
                  { title: 'ТМ2 (член команды)', render: (_: any, r: any) => r.memberTm?.fullName },
                  { title: 'Email', render: (_: any, r: any) => r.memberTm?.email },
                  { title: 'Дата', render: (_: any, r: any) => new Date(r.createdAt).toLocaleDateString('ru-RU') },
                  { title: '', key: 'actions', width: 60, render: (_: any, r: any) => (
                    <Popconfirm title="Удалить ТМ из команды?" onConfirm={() => handleDeleteTeamMember(r.memberTmId)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )},
                ]}
              />
            </div>
          ),
        },
      ]} />
    </div>
  );
}
