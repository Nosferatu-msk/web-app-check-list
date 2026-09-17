import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Checkbox, Button, Spin, Empty, Modal, App } from 'antd';
import { ArrowLeftOutlined, CameraOutlined, CheckOutlined, SendOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileHeader from '../components/MobileHeader';
import PhotoCompareModal from '../components/PhotoCompareModal';

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

const ANOMALY_LABELS: Record<string, string> = {
  photo_phash_match: 'Совпадение фото (pHash)',
  photo_timestamp_mismatch: 'Вне окна визита',
  photo_gps_mismatch: 'GPS не совпадает',
  photo_gallery_source: 'Фото из галереи',
  photo_no_gps: 'GPS недоступен',
};

export default function AnalyticsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareModal, setCompareModal] = useState<{ currentId: string; matchedId: string; distance?: number; percent?: number; info?: string; engineer?: string } | null>(null);

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

  const toggleAnomaly = (anomalyId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(anomalyId)) next.delete(anomalyId); else next.add(anomalyId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!visit) return;
    const openAnomalies = visit.anomalies.filter(a => a.status === 'open');
    if (selectedIds.size === openAnomalies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(openAnomalies.map(a => a.id)));
    }
  };

  const handleReshoot = () => {
    if (selectedIds.size === 0) return;
    Modal.confirm({
      title: 'Запросить пересъёмку',
      content: `Будут удалены ${selectedIds.size} фото с отклонениями. Статус визита будет изменён на «В работе». Продолжить?`,
      okText: 'Запросить пересъёмку',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.reshootVisit(id!, Array.from(selectedIds));
          message.success('Пересъёмка запрошена');
          setSelectedIds(new Set());
          await loadData();
        } catch (err: any) {
          message.error(err.message || 'Ошибка');
        }
      },
    });
  };

  const handleConfirm = () => {
    Modal.confirm({
      title: 'Подтвердить визит',
      content: 'Все отклонения будут отмечены как проверенные. Продолжить?',
      okText: 'Подтвердить',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.confirmVisit(id!);
          message.success('Визит подтверждён');
          await loadData();
        } catch (err: any) {
          message.error(err.message || 'Ошибка');
        }
      },
    });
  };

  const renderVerificationResults = (photo: Anomaly['photo']) => {
    if (!photo?.verificationDetails) return null;
    const details = Array.isArray(photo.verificationDetails) ? photo.verificationDetails : [];

    const checkLabels: Record<string, string> = {
      phash: 'pHash (визуальное сходство)',
      timestamp: 'Timestamp (окно визита)',
      gps: 'GPS-координаты',
      source: 'Источник фото',
    };

    return (
      <div style={{ marginTop: 10, padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Результаты проверок:</div>
        {details.map((d: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
            {d.passed ? (
              <CheckCircleOutlined style={{ color: '#059669', fontSize: 14 }} />
            ) : d.severity === 'critical' ? (
              <CloseCircleOutlined style={{ color: '#DC2626', fontSize: 14 }} />
            ) : d.severity === 'warning' ? (
              <WarningOutlined style={{ color: '#D97706', fontSize: 14 }} />
            ) : (
              <QuestionCircleOutlined style={{ color: '#94A3B8', fontSize: 14 }} />
            )}
            <span style={{ color: '#475569', minWidth: 160 }}>{checkLabels[d.check] || d.check}:</span>
            <span style={{
              color: d.passed ? '#059669' : d.severity === 'critical' ? '#DC2626' : d.severity === 'warning' ? '#D97706' : '#475569',
              fontWeight: 500,
            }}>{d.message}</span>
          </div>
        ))}
        {/* Дополнительные метаданные */}
        <div style={{ marginTop: 6, borderTop: '1px solid #E2E8F0', paddingTop: 6 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#475569' }}>
            <span>Съёмка: {photo.capturedAt ? new Date(photo.capturedAt).toLocaleString('ru-RU') : 'не указана'}</span>
            <span>GPS: {photo.gpsLat != null ? `${photo.gpsLat.toFixed(4)}, ${photo.gpsLng?.toFixed(4)}` : 'не доступен'}</span>
            <span>Источник: {photo.photoSource === 'camera' ? 'Камера' : photo.photoSource === 'gallery' ? 'Галерея' : 'не определён'}</span>
            {photo.phash && <span>pHash: {photo.phash.slice(0, 8)}...</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderDetail = (anomaly: Anomaly) => {
    const d = anomaly.details || {};
    switch (anomaly.type) {
      case 'photo_phash_match':
        return (
          <>
            <DetailRow label="Проверка:" value={`pHash — сходство ${d.similarityPercent || '?'}%`} danger />
            {d.matchInfo && <DetailRow label="Совпадение:" value={d.matchInfo} />}
            {d.matchEngineer && <DetailRow label="Инженер:" value={d.matchEngineer} />}
            {d.hammingDistance != null && <DetailRow label="Расстояние:" value={`${d.hammingDistance} из 64`} />}
            {d.matchedPhotoId && (
              <Button size="small" icon={<EyeOutlined />} style={{ marginTop: 4, borderColor: '#0F766E', color: '#0F766E' }}
                onClick={() => anomaly.photo && setCompareModal({
                  currentId: anomaly.photo.id, matchedId: d.matchedPhotoId,
                  distance: d.hammingDistance, percent: d.similarityPercent,
                  info: d.matchInfo, engineer: d.matchEngineer,
                })}>
                Сравнить с оригиналом
              </Button>
            )}
          </>
        );
      case 'photo_timestamp_mismatch':
        return (
          <>
            <DetailRow label="Проверка:" value="Timestamp — вне окна визита" danger />
            {d.capturedAt && <DetailRow label="Фото сделано:" value={new Date(d.capturedAt).toLocaleString('ru-RU')} danger />}
            {d.visitWindowStart && <DetailRow label="Окно визита:" value={`${new Date(d.visitWindowStart).toLocaleString('ru-RU')} — ${new Date(d.visitWindowEnd).toLocaleString('ru-RU')}`} />}
            {d.differenceMinutes && <DetailRow label="Разница:" value={`~${d.differenceMinutes} мин`} danger />}
          </>
        );
      case 'photo_gps_mismatch':
        return (
          <>
            <DetailRow label="Проверка:" value={`GPS — ${d.distanceMeters || '?'} м от адреса`} warn />
            {d.distanceMeters && <DetailRow label="Расстояние:" value={`${d.distanceMeters} м (макс. ${d.maxDistanceMeters} м)`} warn />}
          </>
        );
      case 'photo_gallery_source':
        return <DetailRow label="Источник:" value="Галерея (не камера)" warn />;
      case 'photo_no_gps':
        return <DetailRow label="GPS:" value="Недоступен" warn />;
      default:
        return null;
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;
  if (!visit) return <Empty description="Визит не найден" />;

  const openAnomalies = visit.anomalies.filter(a => a.status === 'open');

  const content = (
    <>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0' }}>
        {!isMobile && (
          <div style={{ fontSize: 13, color: '#0F766E', cursor: 'pointer', marginBottom: 8 }}
            onClick={() => navigate('/analytics')}>
            ← Аналитика визитов
          </div>
        )}
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

      {/* Anomalies */}
      <div style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Отклонения
            <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
              {visit.anomalies.length}
            </span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Checkbox checked={selectedIds.size === openAnomalies.length && openAnomalies.length > 0} onChange={toggleAll}>
              <span style={{ fontSize: 13, color: '#475569' }}>Выбрать все</span>
            </Checkbox>
          </div>
        </div>

        {visit.anomalies.map(a => (
          <div key={a.id} style={{
            border: `1px solid ${selectedIds.has(a.id) ? '#0F766E' : '#E2E8F0'}`,
            borderLeft: `3px solid ${a.severity === 'critical' ? '#DC2626' : '#D97706'}`,
            borderRadius: 12, marginBottom: 10, overflow: 'hidden',
            background: selectedIds.has(a.id) ? '#F0FDFA' : '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center', borderRight: '1px solid #F1F5F9' }}>
                <Checkbox checked={selectedIds.has(a.id)} onChange={() => toggleAnomaly(a.id)} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CameraOutlined style={{ fontSize: 14 }} /> {a.photo ? `Фото ${a.photo.moment === 'before' ? 'ДО' : 'ПОСЛЕ'}` : 'Фото'} — {ANOMALY_LABELS[a.type] || a.type}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: a.severity === 'critical' ? '#FEE2E2' : '#FEF3C7',
                    color: a.severity === 'critical' ? '#DC2626' : '#92400E',
                  }}>
                    {a.severity === 'critical' ? 'Критическое' : 'Предупреждение'}
                  </span>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {a.photo && <PhotoThumbnail photoId={a.photo.id} />}
                  <div style={{ flex: 1 }}>
                    {renderDetail(a)}
                    {renderVerificationResults(a.photo)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{
        padding: '16px 24px', borderTop: '1px solid #E2E8F0',
        display: 'flex', gap: 10, flexWrap: 'wrap', background: '#F8FAFC', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, color: '#475569', marginRight: 'auto' }}>
          Выбрано: <strong style={{ color: '#0F172A' }}>{selectedIds.size}</strong> из {visit.anomalies.length}
        </span>
        <Button type="primary" icon={<SendOutlined />} disabled={selectedIds.size === 0} onClick={handleReshoot}>
          Запросить пересъёмку
        </Button>
        <Button icon={<CheckOutlined />} style={{ background: '#059669', color: '#fff', borderColor: '#059669' }} onClick={handleConfirm}>
          Подтвердить визит
        </Button>
      </div>
    </>
  );

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      {isMobile ? (
        <>
          <MobileHeader title="Отклонения" showBack onBack={() => navigate('/analytics')} />
          <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}><strong>{visit.visitCode}</strong> — {visit.address}</p>
            <p style={{ fontSize: 13, color: '#475569', margin: '3px 0 0' }}>{visit.engineer.name} · {new Date(visit.dateStart).toLocaleDateString('ru-RU')} · {visit.timeStart}–{visit.timeEnd || ''}</p>
          </div>
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', background: '#fff' }}>
            <span style={{ fontSize: 13, color: '#475569' }}>Выбрано: <strong>{selectedIds.size}</strong> из {visit.anomalies.length}</span>
            <Checkbox checked={selectedIds.size === openAnomalies.length && openAnomalies.length > 0} onChange={toggleAll}>
              <span style={{ fontSize: 12, color: '#475569' }}>Все</span>
            </Checkbox>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {visit.anomalies.map(a => (
              <div key={a.id} style={{
                border: `1px solid ${selectedIds.has(a.id) ? '#0F766E' : '#E2E8F0'}`,
                borderLeft: `3px solid ${a.severity === 'critical' ? '#DC2626' : '#D97706'}`,
                borderRadius: 12, marginBottom: 10, overflow: 'hidden',
                background: selectedIds.has(a.id) ? '#F0FDFA' : '#fff',
              }}>
                <div style={{ padding: '10px 12px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Checkbox checked={selectedIds.has(a.id)} onChange={() => toggleAnomaly(a.id)} />
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{ANOMALY_LABELS[a.type] || a.type}</span>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: a.severity === 'critical' ? '#FEE2E2' : '#FEF3C7',
                    color: a.severity === 'critical' ? '#DC2626' : '#92400E',
                  }}>
                    {a.severity === 'critical' ? 'Крит.' : 'Предупр.'}
                  </span>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {a.photo && <PhotoThumbnail photoId={a.photo.id} />}
                  {renderDetail(a)}
                  {renderVerificationResults(a.photo)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #E2E8F0' }}>
            <Button type="primary" block icon={<SendOutlined />} disabled={selectedIds.size === 0} onClick={handleReshoot}>
              Запросить пересъёмку
            </Button>
            <Button block icon={<CheckOutlined />} style={{ background: '#059669', color: '#fff', borderColor: '#059669' }} onClick={handleConfirm}>
              Подтвердить визит
            </Button>
          </div>
        </>
      ) : (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px' }}>
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
          matchedInfo={compareModal.info}
          matchedEngineer={compareModal.engineer}
        />
      )}
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
      width: 80, height: 60, borderRadius: 6, background: '#F1F5F9',
      border: '1px solid #E2E8F0', overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url ? (
        <img src={url} alt="Фото" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <CameraOutlined style={{ color: '#94A3B8', fontSize: 20 }} />
      )}
    </div>
  );
}

function DetailRow({ label, value, danger, warn }: { label: string; value: string; danger?: boolean; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13 }}>
      <span style={{ color: '#475569', minWidth: 110 }}>{label}</span>
      <span style={{ color: danger ? '#DC2626' : warn ? '#D97706' : '#0F172A', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
