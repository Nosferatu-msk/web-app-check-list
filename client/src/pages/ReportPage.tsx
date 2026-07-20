import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, App, Spin, Result } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import JSZip from 'jszip';
import { api } from '../api/client';

function sanitizeFileName(str: string): string {
  return str.replace(/[^a-zA-Zа-яА-Я0-9_\-]/g, '_').replace(/_+/g, '_');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildBaseName(visit: any): string {
  const street = sanitizeFileName((visit.address?.street || '').replace(/\s/g, ''));
  const house = sanitizeFileName(visit.address?.house || '');
  const date = formatDate(new Date(visit.dateStart)).replace(/\./g, '-');
  return `OTCHET_${street}_${house}_${date}`;
}

export default function ReportPage() {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getVisit(id).then(v => {
      setVisit(v);
      setLoading(false);
    });
  }, [id]);

  const handleGenerate = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      await api.generateReport(id);
      setGenerated(true);
      message.success('Отчёт сформирован');
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!id || !visit) return;
    setDownloading(true);
    try {
      const baseName = buildBaseName(visit);
      const zip = new JSZip();

      // 1. Download PDF
      const pdfUrl = api.downloadReport(id);
      const pdfBlob = await api.downloadFile(pdfUrl);
      zip.file(`${baseName}.pdf`, pdfBlob);

      // 2. Fetch visit with tasks and photos
      const fullVisit = await api.getVisit(id);
      if (!fullVisit || !fullVisit.tasks || fullVisit.tasks.length === 0) {
        message.error('Визит не содержит задач. Невозможно сформировать отчёт.');
        setDownloading(false);
        return;
      }
      const tasks = fullVisit.tasks || [];
      const photosFolder = zip.folder('Photos')!;

      // 3. Download all photos
      for (const task of tasks) {
        // Фото индивидуальных задач
        for (const photo of (task.photos || [])) {
          try {
            const photoUrl = `/api/photos/${photo.id}/file`;
            const photoBlob = await api.downloadFile(photoUrl);
            photosFolder.file(photo.fileName, photoBlob);
          } catch (err) {
            console.warn(`Failed to download photo: ${photo.fileName}`, err);
          }
        }
        // Фото единиц оборудования (групповые задачи)
        for (const item of (task.equipmentItems || [])) {
          for (const photo of (item.photos || [])) {
            try {
              const photoUrl = `/api/photos/${photo.id}/file`;
              const photoBlob = await api.downloadFile(photoUrl);
              photosFolder.file(photo.fileName, photoBlob);
            } catch (err) {
              console.warn(`Failed to download photo: ${photo.fileName}`, err);
            }
          }
        }
      }

      // 4. Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${baseName}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      message.success('ZIP-архив скачан');
    } catch (err: any) {
      if (err.status === 404) {
        message.error('Визит не найден. Возможно, он был удалён.');
      } else if (err.status === 401) {
        message.error('Сессия истекла. Войдите в систему повторно.');
      } else {
        message.error(`Ошибка формирования отчёта: ${err.message || 'Неизвестная ошибка'}`);
      }
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  return (
    <div className="page-container">
      <Card>
        {generated ? (
          <>
            <Result
              status="success"
              title="✅ Отчёт сформирован"
              subTitle={`Акт выполненных работ по адресу: ${visit?.address?.fullAddress}`}
            />
            <Space style={{ width: '100%' }} direction="vertical" size="middle">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadZip}
                loading={downloading}
                block
                size="large"
              >
                💾 Скачать ZIP-архив
              </Button>
              <Button onClick={() => navigate('/')} block>
                ✖ Закрыть
              </Button>
            </Space>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Result title="Визит завершён" subTitle="Сформируйте отчёт для скачивания" />
            <Space direction="vertical" size="middle">
              <Button type="primary" onClick={handleGenerate} loading={generating} size="large">
                📄 Сформировать отчёт
              </Button>
              <Button onClick={() => navigate(`/visit/${id}`)}>Вернуться к визиту</Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
}
