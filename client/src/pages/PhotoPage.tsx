import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Space, App, Spin, Modal, Alert } from 'antd';
import { ArrowLeftOutlined, CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../api/client';

const CLIENT_ZONES = ['kassovaya', 'zona_samoobsl', 'kassa', 'sanitarnyj_uzel', 'kryltso'];

export default function PhotoPage() {
  const { message } = App.useApp();
  const { visitId, taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [warningShown, setWarningShown] = useState(false);
  const [lastUploadedFile, setLastUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!visitId || !taskId) return;
    const t = await api.getTask(visitId, taskId);
    setTask(t);
    const p = await api.getPhotos(taskId);
    setPhotos(p);
    // Show 152-FZ warning for client zones (once per room type per session)
    if (t.roomType && CLIENT_ZONES.includes(t.roomType.code)) {
      const warningKey = `152_warning_${t.roomType.code}`;
      if (!sessionStorage.getItem(warningKey)) {
        Modal.warning({
          title: '⚠️ ВНИМАНИЕ!',
          content: (
            <div>
              <p>Убедитесь, что в кадр не попали:</p>
              <ul>
                <li>Лица посетителей</li>
                <li>Персональные данные на мониторах</li>
                <li>Банковские карты и документы</li>
              </ul>
              <p><em>Согласно ФЗ-152 «О персональных данных»</em></p>
            </div>
          ),
          okText: 'Понятно, сделать фото',
        });
        sessionStorage.setItem(warningKey, '1');
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [visitId, taskId]);

  const handleUpload = async (file: File, moment: 'before' | 'after') => {
    if (!taskId || !visitId) return;
    // Check for duplicate: same file uploaded for the other moment
    if (lastUploadedFile && lastUploadedFile.name === file.name && lastUploadedFile.size === file.size) {
      message.warning('Этот файл уже загружен. Используйте другое фото.');
      return;
    }
    setUploading(true);
    try {
      await api.uploadPhoto(taskId, file, moment);
      const p = await api.getPhotos(taskId);
      setPhotos(p);
      setLastUploadedFile({ name: file.name, size: file.size });

      // Check if task is now complete (all photos + has parameters)
      const photosRequired = task?.equipmentType?.photosRequired || 1;
      if (p.length >= photosRequired) {
        const currentTask = await api.getTask(visitId, taskId);
        const params = currentTask.parameters || {};
        const hasParams = Object.keys(params).length > 0;
        if (hasParams && currentTask.conclusion) {
          await api.updateTask(visitId, taskId, {
            ...currentTask,
            status: 'completed',
          });
        }
      }

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
    if (taskId && visitId) {
      const p = await api.getPhotos(taskId);
      setPhotos(p);
      // Recheck status: if not enough photos, set to in_progress
      const photosRequired = task?.equipmentType?.photosRequired || 1;
      if (p.length < photosRequired) {
        const currentTask = await api.getTask(visitId, taskId);
        await api.updateTask(visitId, taskId, {
          ...currentTask,
          status: 'in_progress',
        });
      }
    }
    message.success('Фото удалено');
  };

  const handleSaveAndReturn = async () => {
    if (!visitId || !taskId || !task) { navigate(`/visit/${visitId}`); return; }
    const photosRequired = task.equipmentType?.photosRequired || 1;
    if (photos.length >= photosRequired) {
      const currentTask = await api.getTask(visitId, taskId);
      const params = currentTask.parameters || {};
      const hasParams = Object.keys(params).length > 0;
      if (hasParams && currentTask.conclusion) {
        await api.updateTask(visitId, taskId, { ...currentTask, status: 'completed' });
      }
    }
    navigate(`/visit/${visitId}`);
  };

  const beforePhoto = photos.find(p => p.moment === 'before');
  const afterPhoto = photos.find(p => p.moment === 'after');
  const photosRequired = task?.equipmentType?.photosRequired || 1;

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/visit/${visitId}/task/${taskId}`)}>Назад</Button>
        <div className="page-title" style={{ margin: 0 }}>Фотофиксация</div>
      </div>

      <Card>
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 16 }}>{task?.equipmentType?.name}</div>
        <div style={{ color: '#888', marginBottom: 16 }}>{task?.roomType?.name || task?.location || ''}</div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>📷 Фото ДО выполнения работ:</div>
          {beforePhoto ? (
            <div style={{ position: 'relative', display: 'inline-block', padding: 4 }}>
              <img src={api.getPhotoUrl(beforePhoto.id)} alt="Фото ДО" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, display: 'block' }} />
              <Button type="text" danger icon={<DeleteOutlined />} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.8)', borderRadius: '50%' }} onClick={() => handleDelete(beforePhoto.id)} />
            </div>
          ) : (
            <Space>
              <Button icon={<CameraOutlined />} onClick={() => beforeRef.current?.click()} loading={uploading}>Сделать фото</Button>
              <input ref={beforeRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 'before')} />
            </Space>
          )}
        </div>

        {photosRequired >= 2 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>📷 Фото ПОСЛЕ выполнения работ:</div>
            {afterPhoto ? (
              <div style={{ position: 'relative', display: 'inline-block', padding: 4 }}>
                <img src={api.getPhotoUrl(afterPhoto.id)} alt="Фото ПОСЛЕ" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, display: 'block' }} />
                <Button type="text" danger icon={<DeleteOutlined />} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.8)', borderRadius: '50%' }} onClick={() => handleDelete(afterPhoto.id)} />
              </div>
            ) : (
              <Space>
                <Button icon={<CameraOutlined />} onClick={() => afterRef.current?.click()} loading={uploading}>Сделать фото</Button>
                <input ref={afterRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 'after')} />
              </Space>
            )}
          </div>
        )}

        <Space style={{ width: '100%' }} direction="vertical" size="middle">
          <Button type="primary" onClick={handleSaveAndReturn} block size="large">
            💾 Сохранить и вернуться в чек-лист
          </Button>
          <Space>
            <Button onClick={() => navigate(`/visit/${visitId}/task/${taskId}`)}>← К параметрам</Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
