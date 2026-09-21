import { useEffect, useState } from 'react';
import { Modal, Spin, Empty, Typography } from 'antd';
import { CameraOutlined, SwapOutlined } from '@ant-design/icons';
import { api } from '../api/client';

const { Text } = Typography;

interface DuplicateEntry {
  photoId: string;
  hammingDistance: number;
  similarityPercent: number;
  isCurrent?: boolean;
  moment: string;
  visitCode: string;
  address: string;
  engineerName: string;
  equipmentType: string;
  visitDate: string;
  visitId: string;
}

interface DuplicatePhotosModalProps {
  open: boolean;
  onClose: () => void;
  photoId: string;
}

function DuplicateThumbnail({ photoId }: { photoId: string }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    api.getPhotoBlobUrl(photoId).then(setUrl).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [photoId]);

  return (
    <div style={{
      width: 80, height: 80, borderRadius: 8, background: '#F1F5F9',
      border: '1px solid #E2E8F0', overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url ? (
        <img src={url} alt="Фото" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <CameraOutlined style={{ color: '#94A3B8', fontSize: 24 }} />
      )}
    </div>
  );
}

export default function DuplicatePhotosModal({ open, onClose, photoId }: DuplicatePhotosModalProps) {
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<DuplicateEntry | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([]);

  useEffect(() => {
    if (!open || !photoId) return;
    setLoading(true);
    api.getPhotoDuplicates(photoId)
      .then(data => {
        setCurrent(data.current || null);
        setDuplicates(data.duplicates || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, photoId]);

  const allEntries = current ? [current, ...duplicates] : duplicates;

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SwapOutlined style={{ color: '#0F766E' }} />
          Сравнение дубликатов
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
      ) : allEntries.length === 0 ? (
        <Empty description="Дубликаты не найдены" style={{ padding: '24px 0' }} />
      ) : (
        <>
          <div style={{
            marginBottom: 12, padding: '8px 12px', background: '#FEF2F2',
            borderRadius: 8, fontSize: 13, color: '#991B1B', border: '1px solid #FECACA',
          }}>
            Обнаружено {allEntries.length} фото с визуальным сходством (pHash). Все они отображены ниже.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
            {allEntries.map((entry) => (
              <div key={entry.photoId} style={{
                display: 'flex', gap: 12, padding: 12,
                border: entry.isCurrent ? '2px solid #0F766E' : '1px solid #E2E8F0',
                borderRadius: 10, background: entry.isCurrent ? '#F0FDFA' : '#fff',
                alignItems: 'center',
              }}>
                <DuplicateThumbnail photoId={entry.photoId} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {entry.isCurrent && (
                      <span style={{
                        padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: '#0F766E', color: '#fff',
                      }}>
                        ТЕКУЩЕЕ
                      </span>
                    )}
                    <Text strong style={{ fontSize: 13 }}>
                      {entry.visitCode || '—'}
                    </Text>
                    <span style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                      background: entry.moment === 'before' ? '#DBEAFE' : '#D1FAE5',
                      color: entry.moment === 'before' ? '#1E40AF' : '#065F46',
                    }}>
                      {entry.moment === 'before' ? 'ДО' : 'ПОСЛЕ'}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                    {entry.engineerName && <div>Инженер: <strong>{entry.engineerName}</strong></div>}
                    {entry.equipmentType && <div>Оборудование: {entry.equipmentType}</div>}
                    <div>Дата визита: {entry.visitDate || '—'}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {entry.isCurrent ? (
                    <span style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: '#E0F2FE', color: '#0369A1',
                    }}>
                      Оригинал
                    </span>
                  ) : (
                    <>
                      <div style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: entry.similarityPercent >= 90 ? '#FEE2E2' : '#FEF3C7',
                        color: entry.similarityPercent >= 90 ? '#DC2626' : '#92400E',
                      }}>
                        {entry.similarityPercent}%
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                        расст. {entry.hammingDistance}/64
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
