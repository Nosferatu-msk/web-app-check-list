import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Tag, Space, Input, App, Modal, List, Typography, Spin, Image, Badge } from 'antd';
import {
  ArrowLeftOutlined, CameraOutlined, DeleteOutlined, PlusOutlined,
  SaveOutlined, CheckCircleOutlined, SearchOutlined, CloudOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, isOffline } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { MtrVisit, MtrVisitWork, Photo, MTR_VISIT_STATUS_LABELS } from '../../../../shared/types/index';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import MobileHeader from '../../components/MobileHeader';
import { db, localId } from '../../db/index';
import { getCachedRefData } from '../../db/sync';

const { Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  in_progress: 'processing',
  completed: 'success',
  sent: 'blue',
  rejected: 'error',
  accepted: 'green',
};

export default function MtrVisitPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { message, modal } = App.useApp();
  const isMobile = useIsMobile();
  const { isOnline, pendingCount } = useOnlineStatus();

  const [visit, setVisit] = useState<MtrVisit | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Create form
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [requestNumber, setRequestNumber] = useState('');
  const [dateStart, setDateStart] = useState(dayjs().format('YYYY-MM-DD'));
  const [timeStart, setTimeStart] = useState(dayjs().format('HH:mm'));

  // Work types search modal
  const [workSearchOpen, setWorkSearchOpen] = useState(false);
  const [workSearchQuery, setWorkSearchQuery] = useState('');
  const [workSearchResults, setWorkSearchResults] = useState<any[]>([]);
  const [workSearching, setWorkSearching] = useState(false);
  const [workComment, setWorkComment] = useState('');
  const [workQuantity, setWorkQuantity] = useState(1);
  const [selectedWorkType, setSelectedWorkType] = useState<any>(null);

  // Photo upload
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);

  // Local photo blob URLs
  const [localPhotoUrls, setLocalPhotoUrls] = useState<Record<string, string>>({});

  const isEditable = visit && (visit.status === 'draft' || visit.status === 'in_progress');

  // Determine state machine state
  const photosBefore = visit?.photos?.filter((p) => p.moment === 'before') || [];
  const photosAfter = visit?.photos?.filter((p) => p.moment === 'after') || [];
  const works = visit?.works || [];

  // State machine:
  // State 1 (no photos): Only "Add Photo BEFORE" button active
  // State 2 (photo before added): "Add work" button active
  // State 3 (works added): Can add/remove works
  // State 4 (photo after added): "Complete visit" button active
  const canAddPhotoBefore = isEditable;
  const canAddWork = isEditable && photosBefore.length > 0;
  const canRemoveWork = isEditable;
  const canAddPhotoAfter = isEditable && works.length > 0;
  const canComplete = isEditable && photosBefore.length > 0 && works.length > 0 && photosAfter.length > 0;
  const canDeletePhotoBefore = isEditable && works.length === 0;
  const canDeletePhotoAfter = isEditable;

  const loadVisit = useCallback(async () => {
    if (!id) return;
    try {
      if (isOffline()) {
        // Load from Dexie
        const localVisit = await db.mtrVisits.get(id);
        if (!localVisit) {
          message.error('Визит не найден');
          navigate('/mtr/visits');
          return;
        }
        const works = await db.mtrVisitWorks.where('mtrVisitLocalId').equals(id).toArray();
        const photos = await db.mtrPhotos.where('mtrVisitLocalId').equals(id).toArray();

        // Resolve work type names from cache
        const cached = await getCachedRefData('mtr-work-types');
        const workTypesMap = new Map<string, any>();
        if (cached?.items) {
          for (const wt of cached.items) workTypesMap.set(wt.id, wt);
        }

        const visitData: any = {
          id: localVisit.serverId || localVisit.id,
          _localId: localVisit.id,
          requestNumber: localVisit.requestNumber,
          dateStart: localVisit.dateStart,
          timeStart: localVisit.timeStart,
          status: localVisit.status,
          isDraft: localVisit.isDraft,
          dirty: localVisit.dirty,
          address: { fullAddress: localVisit.addressId },
          works: works.map((w) => ({
            id: w.serverId || w.id,
            _localId: w.id,
            mtrVisitId: w.mtrVisitLocalId,
            mtrWorkTypeId: w.mtrWorkTypeId,
            quantity: w.quantity,
            comment: w.comment,
            mtrWorkType: workTypesMap.get(w.mtrWorkTypeId) || { name: 'Неизвестный вид работы' },
          })),
          photos: photos.map((p) => ({
            id: p.serverId || p.id,
            _localId: p.id,
            moment: p.moment,
            fileName: p.fileName,
            _isLocal: true,
          })),
        };
        setVisit(visitData);
      } else {
        const data = await api.mtr.getVisit(id);
        setVisit(data);
      }
    } catch (err: any) {
      message.error(err.message || 'Ошибка загрузки визита');
      navigate('/mtr/visits');
    }
    setLoading(false);
  }, [id, message, navigate]);

  useEffect(() => { if (id) loadVisit(); }, [id, loadVisit]);

  // Generate blob URLs for local photos
  useEffect(() => {
    if (!visit?.photos) return;
    const localPhotos = visit.photos.filter((p: any) => p._isLocal);
    if (localPhotos.length === 0) return;

    const generateUrls = async () => {
      const urls: Record<string, string> = {};
      for (const photo of localPhotos) {
        try {
          const localPhoto = await db.mtrPhotos.get(photo.id);
          if (localPhoto) {
            urls[photo.id] = URL.createObjectURL(localPhoto.blob);
          }
        } catch { /* ignore */ }
      }
      setLocalPhotoUrls((prev) => ({ ...prev, ...urls }));
    };
    generateUrls();

    return () => {
      // Cleanup blob URLs
      Object.values(localPhotoUrls).forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, [visit?.photos]);

  // Address search debounce
  useEffect(() => {
    if (!addressSearch || addressSearch.length < 2) {
      setAddressResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await api.mtr.searchAddresses(addressSearch);
        setAddressResults(results || []);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [addressSearch]);

  // Work type search debounce
  useEffect(() => {
    if (!workSearchQuery || workSearchQuery.length < 2) {
      setWorkSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setWorkSearching(true);
      try {
        if (isOffline()) {
          // Search from cached data
          const cached = await getCachedRefData('mtr-work-types');
          if (cached?.items) {
            const q = workSearchQuery.toLowerCase();
            const filtered = cached.items.filter((wt: any) =>
              wt.name.toLowerCase().includes(q) || (wt.category && wt.category.toLowerCase().includes(q))
            );
            setWorkSearchResults(filtered.slice(0, 50));
          } else {
            setWorkSearchResults([]);
          }
        } else {
          const results = await api.mtr.searchWorkTypes(workSearchQuery);
          setWorkSearchResults(results || []);
        }
      } catch { /* ignore */ }
      setWorkSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [workSearchQuery]);

  const handleCreate = async () => {
    if (!selectedAddress) { message.warning('Выберите адрес'); return; }
    if (!requestNumber.trim()) { message.warning('Укажите номер заявки'); return; }
    setSaving(true);
    try {
      const result = await api.mtrCreateVisitOffline({
        addressId: selectedAddress.id,
        requestNumber: requestNumber.trim().toUpperCase(),
        dateStart,
        timeStart,
      });
      if ((result as any)._offline) {
        message.success('Визит сохранён локально (будет отправлен при подключении)');
      } else {
        message.success('Визит создан');
      }
      navigate(`/mtr/visits/${result.id}`, { replace: true });
    } catch (err: any) {
      message.error(err.message);
    }
    setSaving(false);
  };

  const handlePhotoUpload = async (file: File, moment: 'before' | 'after') => {
    if (!visit) return;
    const setUploading = moment === 'before' ? setUploadingBefore : setUploadingAfter;
    setUploading(true);
    try {
      const visitId = (visit as any)._localId || visit.id;
      const result = await api.mtrUploadPhotoOffline(visitId, file, moment);
      if ((result as any)._offline) {
        message.success((moment === 'before' ? 'Фото «до»' : 'Фото «после»') + ' сохранено локально');
      } else {
        message.success(moment === 'before' ? 'Фото «до» загружено' : 'Фото «после» загружено');
      }
      await loadVisit();
    } catch (err: any) {
      message.error(err.message || 'Ошибка загрузки фото');
    }
    setUploading(false);
  };

  const handleDeletePhoto = (photoId: string) => {
    if (!visit) return;
    modal.confirm({
      title: 'Удалить фото?',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.mtr.deleteMtrPhoto(visit.id, photoId);
          message.success('Фото удалено');
          await loadVisit();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleAddWork = async () => {
    if (!visit || !selectedWorkType) return;
    try {
      const visitId = (visit as any)._localId || visit.id;
      const result = await api.mtrAddWorkOffline(visitId, {
        mtrWorkTypeId: selectedWorkType.id,
        quantity: workQuantity,
        comment: workComment || undefined,
      });
      if ((result as any)._offline) {
        message.success('Работа добавлена локально');
      } else {
        message.success('Работа добавлена');
      }
      setWorkSearchOpen(false);
      setWorkSearchQuery('');
      setWorkSearchResults([]);
      setSelectedWorkType(null);
      setWorkComment('');
      setWorkQuantity(1);
      await loadVisit();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleRemoveWork = (workId: string) => {
    if (!visit) return;
    modal.confirm({
      title: 'Удалить работу?',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const visitId = (visit as any)._localId || visit.id;
          await api.mtrRemoveWorkOffline(visitId, workId);
          message.success('Работа удалена');
          await loadVisit();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleSaveDraft = async () => {
    if (!visit) return;
    setSaving(true);
    try {
      if (isOffline()) {
        const visitId = (visit as any)._localId || visit.id;
        await db.mtrVisits.update(visitId, { isDraft: true, dirty: true, updatedAt: new Date().toISOString() });
        message.success('Сохранено локально');
      } else {
        await api.mtr.saveDraft(visit.id);
        message.success('Сохранено как черновик');
      }
    } catch (err: any) {
      message.error(err.message);
    }
    setSaving(false);
  };

  const handleComplete = async () => {
    if (!visit) return;
    modal.confirm({
      title: 'Завершить визит?',
      content: 'После завершения визит будет отправлен на проверку ТМ.',
      okText: 'Завершить',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const visitId = (visit as any)._localId || visit.id;
          const result = await api.mtrCompleteVisitOffline(visitId);
          if ((result as any)._offline) {
            message.success('Визит помечен как завершённый (будет отправлен при подключении)');
          } else {
            message.success('Визит завершён и отправлен');
          }
          await loadVisit();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleDeleteVisit = () => {
    if (!visit) return;
    modal.confirm({
      title: 'Удалить визит?',
      content: 'Визит будет скрыт из списка.',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const visitId = (visit as any)._localId || visit.id;
          await api.mtrDeleteVisitOffline(visitId);
          message.success('Визит удалён');
          navigate('/mtr/visits');
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  // ─── Create form (new visit) ──────────────────────────────
  if (isNew) {
    return (
      <div className="page-container" style={!isMobile ? { maxWidth: 600, margin: '0 auto', padding: 24 } : { padding: 16 }}>
        {isMobile && (
          <MobileHeader title="Новый визит МТР" showBack onBack={() => navigate('/mtr/visits')} />
        )}
        {!isMobile && (
          <div style={{ marginBottom: 24 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/mtr/visits')}>Назад</Button>
            <h2 style={{ margin: '16px 0 0' }}>Новый визит МТР</h2>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Адрес */}
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Адрес *</div>
            <Input
              placeholder="Начните вводить адрес..."
              value={addressSearch}
              onChange={(e) => setAddressSearch(e.target.value)}
            />
            {selectedAddress && (
              <div style={{ marginTop: 8, padding: 8, background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
                <Text strong>{selectedAddress.fullAddress}</Text>
                <Button type="link" size="small" onClick={() => { setSelectedAddress(null); setAddressSearch(''); }}>
                  Изменить
                </Button>
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

          {/* Номер заявки */}
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Номер заявки * (формат SD + 10 цифр)</div>
            <Input
              placeholder="SD1234567890"
              value={requestNumber}
              onChange={(e) => setRequestNumber(e.target.value)}
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          {/* Дата */}
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Дата *</div>
            <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          </div>

          {/* Время */}
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Время *</div>
            <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
          </div>

          <Button type="primary" size="large" onClick={handleCreate} loading={saving} block>
            Создать визит
          </Button>
        </div>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!visit) return null;

  // ─── Visit detail ─────────────────────────────────────────
  return (
    <div className="page-container" style={!isMobile ? { maxWidth: 800, margin: '0 auto', padding: 24 } : { padding: 16 }}>
      {isMobile && (
        <MobileHeader
          title={visit.requestNumber}
          showBack
          onBack={() => navigate('/mtr/visits')}
        />
      )}
      {!isMobile && (
        <div style={{ marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/mtr/visits')}>Назад</Button>
        </div>
      )}

      {/* Offline indicator */}
      {!isOnline && (
        <div style={{ padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CloudOutlined style={{ color: '#fa8c16' }} />
          <span>Офлайн-режим</span>
          {pendingCount > 0 && <Badge count={pendingCount} style={{ backgroundColor: '#fa8c16' }} />}
          {(visit as any)?.dirty && <Tag color="orange" style={{ marginLeft: 'auto' }}>Не синхронизировано</Tag>}
        </div>
      )}

      {/* Header info */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{visit.requestNumber}</h2>
          <Tag color={STATUS_COLORS[visit.status] || 'default'} style={{ fontSize: 14, padding: '2px 12px' }}>
            {MTR_VISIT_STATUS_LABELS[visit.status as keyof typeof MTR_VISIT_STATUS_LABELS] || visit.status}
          </Tag>
        </div>
        <div style={{ color: '#666', marginBottom: 4 }}>{visit.address?.fullAddress}</div>
        <div style={{ color: '#999', fontSize: 14 }}>
          {dayjs(visit.dateStart).format('DD.MM.YYYY')} в {visit.timeStart}
        </div>
        {visit.rejectionReason && (
          <div style={{ marginTop: 8, padding: 8, background: '#fff2f0', borderRadius: 6, border: '1px solid #ffccc7' }}>
            <Text type="danger">Причина отклонения: {visit.rejectionReason}</Text>
          </div>
        )}
      </div>

      {/* Фото ДО */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Фото ДО</h3>
          {canAddPhotoBefore && (
            <Button
              icon={<CameraOutlined />}
              onClick={() => fileInputBeforeRef.current?.click()}
              loading={uploadingBefore}
              size="small"
            >
              {isMobile ? 'Фото' : 'Добавить фото'}
            </Button>
          )}
        </div>
        <input
          ref={fileInputBeforeRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoUpload(file, 'before');
            e.target.value = '';
          }}
        />
        {photosBefore.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photosBefore.map((photo) => (
              <div key={photo.id} style={{ position: 'relative' }}>
                <Image
                  src={(photo as any)._isLocal ? (localPhotoUrls[photo.id] || '') : `/api/photos/${photo.id}/file`}
                  width={isMobile ? 80 : 120}
                  height={isMobile ? 80 : 120}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                />
                {canDeletePhotoBefore && (
                  <Button
                    type="primary"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{ position: 'absolute', top: 4, right: 4, borderRadius: '50%', width: 28, height: 28, padding: 0 }}
                    onClick={() => handleDeletePhoto(photo.id)}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', background: '#fafafa', borderRadius: 8, color: '#999' }}>
            {canAddPhotoBefore ? 'Добавьте фото «до»' : 'Нет фото'}
          </div>
        )}
      </div>

      {/* Работы */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Работы ({works.length})</h3>
          {canAddWork && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setWorkSearchOpen(true)}
              size="small"
            >
              Добавить работу
            </Button>
          )}
        </div>
        {works.length > 0 ? (
          <List
            size="small"
            bordered
            dataSource={works}
            renderItem={(work: MtrVisitWork) => (
              <List.Item
                actions={
                  canRemoveWork
                    ? [<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveWork(work.id)} />]
                    : undefined
                }
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{work.mtrWorkType?.name || '—'}</div>
                  {work.quantity > 1 && <div style={{ fontSize: 12, color: '#666' }}>Кол-во: {work.quantity}</div>}
                  {work.comment && <div style={{ fontSize: 12, color: '#999' }}>{work.comment}</div>}
                </div>
              </List.Item>
            )}
          />
        ) : (
          <div style={{ padding: 20, textAlign: 'center', background: '#fafafa', borderRadius: 8, color: '#999' }}>
            {canAddWork ? 'Добавьте работы' : 'Сначала добавьте фото «до»'}
          </div>
        )}
      </div>

      {/* Фото ПОСЛЕ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Фото ПОСЛЕ</h3>
          {canAddPhotoAfter && (
            <Button
              icon={<CameraOutlined />}
              onClick={() => fileInputAfterRef.current?.click()}
              loading={uploadingAfter}
              size="small"
            >
              {isMobile ? 'Фото' : 'Добавить фото'}
            </Button>
          )}
        </div>
        <input
          ref={fileInputAfterRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoUpload(file, 'after');
            e.target.value = '';
          }}
        />
        {photosAfter.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photosAfter.map((photo) => (
              <div key={photo.id} style={{ position: 'relative' }}>
                <Image
                  src={(photo as any)._isLocal ? (localPhotoUrls[photo.id] || '') : `/api/photos/${photo.id}/file`}
                  width={isMobile ? 80 : 120}
                  height={isMobile ? 80 : 120}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                />
                {canDeletePhotoAfter && (
                  <Button
                    type="primary"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{ position: 'absolute', top: 4, right: 4, borderRadius: '50%', width: 28, height: 28, padding: 0 }}
                    onClick={() => handleDeletePhoto(photo.id)}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', background: '#fafafa', borderRadius: 8, color: '#999' }}>
            {canAddPhotoAfter ? 'Добавьте фото «после»' : 'Сначала добавьте работы'}
          </div>
        )}
      </div>

      {/* Действия */}
      {isEditable && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
          <Button icon={<SaveOutlined />} onClick={handleSaveDraft} loading={saving}>
            Сохранить черновик
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleComplete}
            disabled={!canComplete}
            loading={saving}
          >
            Завершить визит
          </Button>
          {(visit.status === 'draft' || visit.status === 'in_progress') && (
            <Button danger onClick={handleDeleteVisit}>
              Удалить визит
            </Button>
          )}
        </div>
      )}

      {/* Модалка поиска видов работ */}
      <Modal
        title="Добавить работу"
        open={workSearchOpen}
        onCancel={() => {
          setWorkSearchOpen(false);
          setWorkSearchQuery('');
          setWorkSearchResults([]);
          setSelectedWorkType(null);
          setWorkComment('');
          setWorkQuantity(1);
        }}
        onOk={handleAddWork}
        okText="Добавить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !selectedWorkType }}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="Поиск вида работы..."
            prefix={<SearchOutlined />}
            value={workSearchQuery}
            onChange={(e) => setWorkSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {workSearching ? (
          <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
        ) : (
          <List
            size="small"
            bordered
            style={{ maxHeight: 300, overflowY: 'auto' }}
            dataSource={workSearchResults}
            locale={{ emptyText: workSearchQuery.length < 2 ? 'Введите минимум 2 символа' : 'Ничего не найдено' }}
            renderItem={(item) => (
              <List.Item
                onClick={() => setSelectedWorkType(item)}
                style={{
                  cursor: 'pointer',
                  background: selectedWorkType?.id === item.id ? '#e6f4ff' : undefined,
                  padding: '8px 12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: selectedWorkType?.id === item.id ? 600 : 400 }}>{item.name}</div>
                  {item.category && <div style={{ fontSize: 12, color: '#999' }}>{item.category}</div>}
                </div>
              </List.Item>
            )}
          />
        )}

        {selectedWorkType && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong>Выбрано: {selectedWorkType.name}</Text>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}>Количество</div>
              <Input
                type="number"
                min={1}
                value={workQuantity}
                onChange={(e) => setWorkQuantity(parseInt(e.target.value) || 1)}
                style={{ width: 120 }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>Комментарий (необязательно)</div>
              <Input.TextArea
                value={workComment}
                onChange={(e) => setWorkComment(e.target.value)}
                rows={2}
                placeholder="Комментарий к работе..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
