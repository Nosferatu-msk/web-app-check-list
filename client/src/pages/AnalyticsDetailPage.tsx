import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Checkbox, Button, Spin, Empty, Modal, App } from 'antd';
import {
  ArrowLeftOutlined, CameraOutlined, CheckOutlined, SendOutlined, EyeOutlined,
  CheckCircleOutlined, CloseCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileHeader from '../components/MobileHeader';
import PhotoCompareModal from '../components/PhotoCompareModal';
import DuplicatePhotosModal from '../components/DuplicatePhotosModal';

interface Anomaly {
  id: string;
  type: string;
  severity: string;
  status: string;
  details: any;
  createdAt: string;
  photo?: {
    id: string; fileName: string; moment: string;
    verificationStatus: string; verificationDetails: any[];
    capturedAt?: string; gpsLat?: number; gpsLng?: number;
    photoSource?: string; phash?: string;
  } | null;
}

interface VisitDetail {
  visitId: string;
  visitCode: string;
  address: string;
  engineer: { id: string; name: string };
  dateStart: string;
  timeStart: string;
  timeEnd?: string;
  visitStatus: string;
  anomalies: Anomaly[];
}

interface PhotoGroup {
  photoId: string;
  photo: NonNullable<Anomaly['photo']>;
  anomalies: Anomaly[];
  maxSeverity: 'critical' | 'warning';
  openCount: number;
}

const CHECK_LABELS: Record<string, string> = {
  phash: 'pHash (визуальное сходство)',
  timestamp: 'Timestamp (окно визита)',
  gps: 'GPS-координаты',
  source: 'Источник фото',
};

const CHECK_TO_ANOMALY: Record<string, string> = {
  phash: 'photo_phash_match',
  timestamp: 'photo_timestamp_mismatch',
  gps: 'photo_gps_mismatch',
  source: 'photo_gallery_source',
};

export default function AnalyticsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [compareModal, setCompareModal] = useState<{
    currentId: string; matchedId: string; distance?: number; percent?: number;
    currentInfo?: { engineer?: string; date?: string; equipment?: string; moment?: string };
    matchedInfo?: { engineer?: string; date?: string; equipment?: string; moment?: string };
  } | null>(null);
  const [duplicateModal, setDuplicateModal] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getAnalyticsVisit(id);
      setVisit(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const photoGroups = useMemo(() => {
    if (!visit) return [];
    const map = new Map<string, PhotoGroup>();
    for (const a of visit.anomalies) {
      if (!a.photo) continue;
      const pid = a.photo.id;
      if (!map.has(pid)) {
        map.set(pid, {
          photoId: pid,
          photo: a.photo,
          anomalies: [],
          maxSeverity: 'warning',
          openCount: 0,
        });
      }
      const g = map.get(pid)!;
      g.anomalies.push(a);
      if (a.severity === 'critical') g.maxSeverity = 'critical';
      if (a.status === 'open') g.openCount++;
    }
    return Array.from(map.values());
  }, [visit]);

  const totalOpenAnomalies = visit?.anomalies.filter(a => a.status === 'open').length ?? 0;

  const togglePhoto = (photoId: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const toggleAllPhotos = () => {
    if (!photoGroups.length) return;
    const photosWithOpen = photoGroups.filter(g => g.openCount > 0);
    if (selectedPhotos.size === photosWithOpen.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photosWithOpen.map(g => g.photoId)));
    }
  };

  const selectedAnomalyCount = useMemo(() => {
    let count = 0;
    for (const g of photoGroups) {
      if (selectedPhotos.has(g.photoId)) {
        count += g.anomalies.filter(a => a.status === 'open').length;
      }
    }
    return count;
  }, [photoGroups, selectedPhotos]);

  const handleReshoot = () => {
    // Пересъёмка для НЕотмеченных фото (подозрительные)
    const unselectedOpen = photoGroups.filter(g => g.openCount > 0 && !selectedPhotos.has(g.photoId));
    if (unselectedOpen.length === 0) return;
    const anomalyIds: string[] = [];
    for (const g of unselectedOpen) {
      anomalyIds.push(...g.anomalies.filter(a => a.status === 'open').map(a => a.id));
    }
    Modal.confirm({
      title: 'Запросить пересъёмку',
      content: `Будут удалены ${unselectedOpen.length} фото (${anomalyIds.length} отклонений). Статус визита будет изменён на «В работе». Продолжить?`,
      okText: 'Запросить пересъёмку',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.reshootVisit(id!, anomalyIds);
          message.success('Пересъёмка запрошена');
          setSelectedPhotos(new Set());
          await loadData();
        } catch (err: any) {
          message.error(err.message || 'Ошибка');
        }
      },
    });
  };

  const handleConfirm = () => {
    // Подтвердить (dismiss) отмеченные фото — ТМ проверила и всё нормально
    if (selectedPhotos.size === 0) return;
    const anomalyIds: string[] = [];
    for (const g of photoGroups) {
      if (selectedPhotos.has(g.photoId)) {
        anomalyIds.push(...g.anomalies.filter(a => a.status === 'open').map(a => a.id));
      }
    }
    Modal.confirm({
      title: 'Подтвердить отклонения',
      content: `${selectedPhotos.size} фото (${anomalyIds.length} отклонений) будут отмечены как проверенные и исчезнут из списка. Продолжить?`,
      okText: 'Подтвердить',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.batchUpdateAnomalies(anomalyIds, 'dismissed');
          message.success('Отклонения подтверждены');
          setSelectedPhotos(new Set());
          await loadData();
        } catch (err: any) {
          message.error(err.message || 'Ошибка');
        }
      },
    });
  };

  const anomalyMap = useMemo(() => {
    const m = new Map<string, Anomaly>();
    if (!visit) return m;
    for (const a of visit.anomalies) m.set(a.type, a);
    // Также сохраняем photo_no_gps отдельно, т.к. gps может маппиться на два типа
    for (const a of visit.anomalies) {
      if (a.type === 'photo_no_gps') m.set('photo_no_gps', a);
    }
    return m;
  }, [visit]);

  const renderCheckDetail = (check: string, photoId: string) => {
    const anomalyType = CHECK_TO_ANOMALY[check];
    // Для gps: сначала ищем gps_mismatch, потом no_gps
    const anomaly = (check === 'gps'
      ? (anomalyMap.get('photo_gps_mismatch') || anomalyMap.get('photo_no_gps'))
      : anomalyMap.get(anomalyType));
    const d = anomaly?.details || {};

    if (check === 'phash' && !d.passed && d.matchedPhotoId) {
      return (
        <span>
          Сходство {d.similarityPercent || '?'}%
          {d.matchInfo && ` — ${d.matchInfo}`}
          {d.hammingDistance != null && <span style={{ color: '#94A3B8', marginLeft: 6 }}>(расст. {d.hammingDistance}/64)</span>}
        </span>
      );
    }
    if (check === 'timestamp' && !d.passed) {
      return <span>Сделано за {d.differenceMinutes || '?'} мин до окна визита</span>;
    }
    if (check === 'gps' && !d.passed) {
      if (d.distanceMeters) return <span>В {d.distanceMeters} м от адреса объекта</span>;
      return <span>Координаты недоступны</span>;
    }
    if (check === 'source' && !d.passed) {
      return <span>Загружено из галереи</span>;
    }
    return null;
  };

  const renderPhotoCard = (group: PhotoGroup) => {
    const { photoId, photo, anomalies } = group;
    const isSelected = selectedPhotos.has(photoId);
    const hasOpen = group.openCount > 0;
    const checks = Array.isArray(photo.verificationDetails) ? photo.verificationDetails : [];
    const failedCount = checks.filter((c: any) => !c.passed).length;
    const borderColor = group.maxSeverity === 'critical' ? '#DC2626' : '#D97706';

    return (
      <div key={photoId} style={{
        border: isSelected ? '1px solid #0F766E' : '1px solid #E2E8F0',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 10, marginBottom: 12, overflow: 'hidden',
        background: isSelected ? '#F0FDFA' : '#fff',
        transition: 'all 0.2s',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9',
        }}>
          {hasOpen && (
            <Checkbox
              checked={isSelected}
              indeterminate={!isSelected && anomalies.some(a => selectedPhotos.has(photoId))}
              onChange={() => togglePhoto(photoId)}
            />
          )}
          <PhotoThumbnail photoId={photoId} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>
              Фото {photo.moment === 'before' ? 'ДО' : 'ПОСЛЕ'}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
              {photo.capturedAt ? new Date(photo.capturedAt).toLocaleString('ru-RU') : 'Время не указано'}
              {photo.photoSource === 'gallery' ? ' · из галереи' : ''}
            </div>
          </div>
          <span style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0,
            background: group.maxSeverity === 'critical' ? '#FEE2E2' : '#FEF3C7',
            color: group.maxSeverity === 'critical' ? '#DC2626' : '#92400E',
          }}>
            {group.maxSeverity === 'critical' ? 'Критично' : 'Предупреждение'}
          </span>
        </div>

        {/* Check results */}
        <div style={{ padding: '6px 14px' }}>
          {checks.map((check: any, i: number) => {
            const isPassed = check.passed;
            const isCritical = !isPassed && check.severity === 'critical';
            const isWarning = !isPassed && check.severity === 'warning';
            const icon = isPassed
              ? <CheckCircleOutlined style={{ color: '#059669', fontSize: 14 }} />
              : isCritical
                ? <CloseCircleOutlined style={{ color: '#DC2626', fontSize: 14 }} />
                : isWarning
                  ? <WarningOutlined style={{ color: '#D97706', fontSize: 14 }} />
                  : <CheckCircleOutlined style={{ color: '#94A3B8', fontSize: 14 }} />;
            const textColor = isPassed ? '#059669' : isCritical ? '#DC2626' : isWarning ? '#D97706' : '#475569';

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '7px 0',
                borderBottom: i < checks.length - 1 ? '1px solid #F8FAFC' : 'none',
              }}>
                <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                    {CHECK_LABELS[check.check] || check.check}
                  </div>
                  {!isPassed ? (
                    <div style={{ fontSize: 12, color: textColor, marginTop: 2, fontWeight: 500 }}>
                      {renderCheckDetail(check.check, photoId) || check.message}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#059669', marginTop: 1 }}>{check.message}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Metadata footer */}
        <div style={{
          padding: '6px 14px', borderTop: '1px solid #F1F5F9',
          display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#94A3B8', alignItems: 'center',
        }}>
          <span>GPS: {photo.gpsLat != null ? `${photo.gpsLat.toFixed(4)}, ${photo.gpsLng?.toFixed(4)}` : '—'}</span>
          {photo.phash && <span>pHash: {photo.phash.slice(0, 8)}…</span>}
          <span>{failedCount} из {checks.length} проверок не пройдено</span>
          {photo.phash && checks.some((c: any) => c.check === 'phash' && !c.passed) && (
            <Button size="small" icon={<EyeOutlined />}
              style={{ marginLeft: 'auto', borderColor: '#0F766E', color: '#0F766E', fontSize: 11, height: 24 }}
              onClick={() => setDuplicateModal(photoId)}>
              Сравнение
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;
  if (!visit) return <Empty description="Визит не найден" />;

  const photosWithOpen = photoGroups.filter(g => g.openCount > 0);

  const content = (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="page-title" style={{ margin: 0, fontSize: 16 }}>Отклонения визита</div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/analytics')}>Назад</Button>
      </div>
      <div style={{ padding: '0 0 16px', borderBottom: '1px solid #E2E8F0', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          Визит {visit.visitCode} — {visit.address}
        </h1>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#475569' }}>Инженер: <strong style={{ color: '#0F172A' }}>{visit.engineer.name}</strong></span>
          <span style={{ fontSize: 13, color: '#475569' }}>Дата: <strong style={{ color: '#0F172A' }}>{new Date(visit.dateStart).toLocaleDateString('ru-RU')}, {visit.timeStart}{visit.timeEnd ? ` — ${visit.timeEnd}` : ''}</strong></span>
          <span style={{
            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
            background: '#E0F2FE', color: '#0369A1',
          }}>
            {visit.visitStatus === 'completed' ? 'Завершён' : visit.visitStatus === 'in_progress' ? 'В работе' : visit.visitStatus}
          </span>
        </div>
      </div>

      {/* Photo cards */}
      <div style={{ padding: '16px 24px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #F1F5F9',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Фото с отклонениями
            <span style={{
              background: '#FEE2E2', color: '#DC2626', padding: '2px 8px',
              borderRadius: 6, fontSize: 12, fontWeight: 600,
            }}>
              {photoGroups.length}
            </span>
          </h3>
          <Checkbox
            checked={selectedPhotos.size === photosWithOpen.length && photosWithOpen.length > 0}
            onChange={toggleAllPhotos}
          >
            <span style={{ fontSize: 13, color: '#475569' }}>Выбрать все</span>
          </Checkbox>
        </div>

        {photoGroups.map(renderPhotoCard)}
      </div>

      {/* Actions */}
      <div style={{
        padding: '16px 24px', borderTop: '1px solid #E2E8F0',
        display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC',
      }}>
        <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
          Отметьте галочками фото, по которым отклонения сняты. Отмеченные можно подтвердить, по неотмеченным — запросить пересъёмку.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#475569', marginRight: 'auto' }}>
            Отмечено: <strong style={{ color: '#0F172A' }}>{selectedPhotos.size}</strong> из {photoGroups.length}
            {selectedAnomalyCount > 0 && (
              <span style={{ color: '#94A3B8', marginLeft: 8 }}>({selectedAnomalyCount} откл.)</span>
            )}
          </span>
          <Button type="primary" danger icon={<SendOutlined />}
            disabled={photoGroups.length - selectedPhotos.size === 0}
            onClick={handleReshoot}>
            Пересъёмка ({photoGroups.length - selectedPhotos.size})
          </Button>
          <Button icon={<CheckOutlined />} style={{ background: '#059669', color: '#fff', borderColor: '#059669' }}
            disabled={selectedPhotos.size === 0}
            onClick={handleConfirm}>
            Подтвердить ({selectedPhotos.size})
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      {isMobile ? (
        <>
          <MobileHeader title="Отклонения" showBack onBack={() => navigate('/analytics')} />
          <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
              <strong>{visit.visitCode}</strong> — {visit.address}
            </p>
            <p style={{ fontSize: 13, color: '#475569', margin: '3px 0 0' }}>
              {visit.engineer.name} · {new Date(visit.dateStart).toLocaleDateString('ru-RU')} · {visit.timeStart}–{visit.timeEnd || ''}
            </p>
          </div>
          <div style={{
            padding: '10px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', background: '#fff',
          }}>
            <span style={{ fontSize: 13, color: '#475569' }}>
              {photoGroups.length} фото · <strong>{selectedPhotos.size}</strong> выбрано
            </span>
            <Checkbox
              checked={selectedPhotos.size === photosWithOpen.length && photosWithOpen.length > 0}
              onChange={toggleAllPhotos}
            >
              <span style={{ fontSize: 12, color: '#475569' }}>Все</span>
            </Checkbox>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {photoGroups.map(renderPhotoCard)}
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #E2E8F0' }}>
            <Button type="primary" danger block icon={<SendOutlined />}
              disabled={photoGroups.length - selectedPhotos.size === 0}
              onClick={handleReshoot}>
              Пересъёмка ({photoGroups.length - selectedPhotos.size})
            </Button>
            <Button block icon={<CheckOutlined />} style={{ background: '#059669', color: '#fff', borderColor: '#059669' }}
              disabled={selectedPhotos.size === 0}
              onClick={handleConfirm}>
              Подтвердить ({selectedPhotos.size})
            </Button>
          </div>
        </>
      ) : (
        <div className="page-container" style={{ maxWidth: 1400 }}>
          <Card style={{ borderRadius: 12, marginTop: 20, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            {content}
          </Card>
        </div>
      )}

      {compareModal && (
        <PhotoCompareModal
          open={!!compareModal}
          onClose={() => setCompareModal(null)}
          currentPhotoId={compareModal.currentId}
          matchedPhotoId={compareModal.matchedId}
          hammingDistance={compareModal.distance}
          similarityPercent={compareModal.percent}
          currentInfo={compareModal.currentInfo}
          matchedInfo={compareModal.matchedInfo}
        />
      )}

      <DuplicatePhotosModal
        open={!!duplicateModal}
        onClose={() => setDuplicateModal(null)}
        photoId={duplicateModal || ''}
      />
    </div>
  );
}

function PhotoThumbnail({ photoId }: { photoId: string }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    api.getPhotoBlobUrl(photoId).then(setUrl).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [photoId]);

  return (
    <div style={{
      width: 48, height: 48, borderRadius: 8, background: '#F1F5F9',
      border: '1px solid #E2E8F0', overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url ? (
        <img src={url} alt="Фото" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <CameraOutlined style={{ color: '#94A3B8', fontSize: 18 }} />
      )}
    </div>
  );
}
