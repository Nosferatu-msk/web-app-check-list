import { Modal, Typography } from 'antd';
import { api } from '../api/client';
import { useEffect, useState } from 'react';

const { Text } = Typography;

interface PhotoCompareModalProps {
  open: boolean;
  onClose: () => void;
  currentPhotoId: string;
  matchedPhotoId: string;
  hammingDistance?: number;
  similarityPercent?: number;
  currentInfo?: { engineer?: string; date?: string; equipment?: string; moment?: string };
  matchedInfo?: { engineer?: string; date?: string; equipment?: string; moment?: string };
}

export default function PhotoCompareModal({
  open, onClose, currentPhotoId, matchedPhotoId,
  hammingDistance, similarityPercent, currentInfo, matchedInfo,
}: PhotoCompareModalProps) {
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [matchedUrl, setMatchedUrl] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    api.getPhotoBlobUrl(currentPhotoId).then(setCurrentUrl).catch(() => {});
    api.getPhotoBlobUrl(matchedPhotoId).then(setMatchedUrl).catch(() => {});
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      if (matchedUrl) URL.revokeObjectURL(matchedUrl);
    };
  }, [open, currentPhotoId, matchedPhotoId]);

  return (
    <Modal
      title="Сравнение фото"
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '100%', height: 200, background: '#F1F5F9', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #E2E8F0', overflow: 'hidden',
          }}>
            {currentUrl ? (
              <img src={currentUrl} alt="Текущее фото" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Text type="secondary">Загрузка...</Text>
            )}
          </div>
          <Text strong style={{ display: 'block', marginTop: 8 }}>Текущее фото</Text>
          {currentInfo && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
              {currentInfo.engineer && <div>{currentInfo.engineer}</div>}
              {currentInfo.date && <div>{currentInfo.date}</div>}
              {currentInfo.equipment && <div>{currentInfo.equipment} · Фото {currentInfo.moment === 'before' ? 'ДО' : 'ПОСЛЕ'}</div>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '100%', height: 200, background: '#F1F5F9', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #DC2626', overflow: 'hidden',
          }}>
            {matchedUrl ? (
              <img src={matchedUrl} alt="Совпадающее фото" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Text type="secondary">Загрузка...</Text>
            )}
          </div>
          <Text strong style={{ display: 'block', marginTop: 8 }}>Совпадающее фото</Text>
          {matchedInfo && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
              {matchedInfo.engineer && <div>{matchedInfo.engineer}</div>}
              {matchedInfo.date && <div>{matchedInfo.date}</div>}
              {matchedInfo.equipment && <div>{matchedInfo.equipment} · Фото {matchedInfo.moment === 'before' ? 'ДО' : 'ПОСЛЕ'}</div>}
            </div>
          )}
        </div>
      </div>
      {hammingDistance != null && (
        <div style={{
          marginTop: 12, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8,
          fontSize: 13, color: '#DC2626', border: '1px solid #FECACA',
        }}>
          pHash расстояние Хэмминга: {hammingDistance} из 64 ({similarityPercent}% сходства). Фото визуально идентичны.
        </div>
      )}
    </Modal>
  );
}
