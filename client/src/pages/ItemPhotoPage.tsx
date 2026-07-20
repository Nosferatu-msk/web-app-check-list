import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Space, App, Spin } from 'antd';
import { ArrowLeftOutlined, CameraOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import { api } from '../api/client';

const compressImage = async (file: File, maxPixels: number = 2073600): Promise<File> => {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(file); return; }
    img.onload = () => {
      let { width, height } = img;
      const totalPixels = width * height;
      if (totalPixels <= maxPixels) { resolve(file); return; }
      const scale = Math.sqrt(maxPixels / totalPixels);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => { resolve(file); };
    img.src = URL.createObjectURL(file);
  });
};

const ITEM_TYPE_NAMES: Record<string, string> = {
  splitvn: 'Внутр. блок СС',
  mssvn: 'Внутр. блок МСС',
  vrv_vn: 'Внутр. блок VRV',
  splitnar: 'Наружн. блок СС',
  mssnar: 'Наружн. блок МСС',
  vrv_nar: 'Наружн. блок VRV',
};

export default function ItemPhotoPage() {
  const { message } = App.useApp();
  const { visitId, taskId, itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const beforeGalleryRef = useRef<HTMLInputElement>(null);
  const afterGalleryRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!visitId || !taskId) return;
    const t = await api.getTask(visitId, taskId);
    const foundItem = (t.equipmentItems || []).find((i: any) => i.id === itemId);
    if (foundItem) {
      setItem(foundItem);
      setPhotos(foundItem.photos || []);
      const urls: Record<string, string> = {};
      for (const photo of (foundItem.photos || [])) {
        try { urls[photo.id] = await api.getPhotoBlobUrl(photo.id); } catch { /* ignore */ }
      }
      setPhotoUrls(urls);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [visitId, taskId, itemId]);

  const handleUpload = async (file: File, moment: 'before' | 'after') => {
    if (!itemId) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      await api.uploadItemPhoto(itemId, compressed, moment);
      await loadData();
      message.success('Фото загружено');
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, moment: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, moment);
    e.target.value = '';
  };

  const handleDelete = async (photoId: string) => {
    await api.deletePhoto(photoId);
    await loadData();
    message.success('Фото удалено');
  };

  const beforePhoto = photos.find(p => p.moment === 'before');
  const afterPhoto = photos.find(p => p.moment === 'after');
  const eq = item?.objectEquipment;
  const itemName = eq ? `${ITEM_TYPE_NAMES[eq.equipmentTypeCode] || eq.equipmentTypeCode} · ${eq.brand || ''} ${eq.model || ''}`.trim() : '';

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (!item) return <div style={{ textAlign: 'center', padding: 40 }}>Единица не найдена</div>;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/visit/${visitId}/task/${taskId}/group`)}>Назад</Button>
        <div className="page-title" style={{ margin: 0 }}>Фотофиксация</div>
      </div>

      <Card>
        <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 16 }}>{itemName}</div>
        {eq?.serialNumber && <div style={{ color: '#888', marginBottom: 16 }}>Серийный номер: {eq.serialNumber}</div>}

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>📷 Фото ДО выполнения работ:</div>
          {beforePhoto ? (
            <div style={{ position: 'relative', display: 'inline-block', padding: 4 }}>
              <img src={photoUrls[beforePhoto.id] || ''} alt="Фото ДО" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, display: 'block' }} />
              <Button type="text" danger icon={<DeleteOutlined />} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.8)', borderRadius: '50%' }} onClick={() => handleDelete(beforePhoto.id)} />
            </div>
          ) : (
            <Space wrap>
              <Button icon={<CameraOutlined />} onClick={() => beforeRef.current?.click()} loading={uploading}>Камера</Button>
              <Button icon={<PictureOutlined />} onClick={() => beforeGalleryRef.current?.click()} loading={uploading}>Галерея</Button>
              <input ref={beforeRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 'before')} />
              <input ref={beforeGalleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 'before')} />
            </Space>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>📷 Фото ПОСЛЕ выполнения работ:</div>
          {afterPhoto ? (
            <div style={{ position: 'relative', display: 'inline-block', padding: 4 }}>
              <img src={photoUrls[afterPhoto.id] || ''} alt="Фото ПОСЛЕ" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, display: 'block' }} />
              <Button type="text" danger icon={<DeleteOutlined />} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.8)', borderRadius: '50%' }} onClick={() => handleDelete(afterPhoto.id)} />
            </div>
          ) : (
            <Space wrap>
              <Button icon={<CameraOutlined />} onClick={() => afterRef.current?.click()} loading={uploading}>Камера</Button>
              <Button icon={<PictureOutlined />} onClick={() => afterGalleryRef.current?.click()} loading={uploading}>Галерея</Button>
              <input ref={afterRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 'after')} />
              <input ref={afterGalleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 'after')} />
            </Space>
          )}
        </div>

        <Space style={{ width: '100%' }} direction="vertical" size="middle">
          <Button type="primary" onClick={() => navigate(`/visit/${visitId}/task/${taskId}/group`)} block size="large">
            💾 Сохранить и вернуться
          </Button>
          <Button onClick={() => navigate(`/visit/${visitId}/task/${taskId}/group`)}>← К задаче</Button>
        </Space>
      </Card>
    </div>
  );
}
