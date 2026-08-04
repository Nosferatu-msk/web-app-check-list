import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, App, Spin, Result } from 'antd';
import { DownloadOutlined, FilePdfOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import JSZip from 'jszip';
import { api } from '../../api/client';
import { MtrVisit } from '../../../../shared/types/index';
import dayjs from 'dayjs';

function sanitizeFileName(str: string): string {
  return str.replace(/[^a-zA-Zа-яА-Я0-9_\-]/g, '_').replace(/_+/g, '_');
}

function buildBaseName(visit: MtrVisit): string {
  const rn = sanitizeFileName(visit.requestNumber);
  const date = dayjs(visit.dateStart).format('DD-MM-YYYY');
  return `MTR_${rn}_${date}`;
}

export default function MtrReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [visit, setVisit] = useState<MtrVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.mtr.getVisit(id).then((v: MtrVisit) => {
      setVisit(v);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  const handleGenerate = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      await api.generateMtrReport(id);
      setGenerated(true);
      message.success('Отчёт сформирован');
    } catch (err: any) {
      message.error(err.message || 'Ошибка формирования отчёта');
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
      const pdfUrl = api.downloadMtrReport(id);
      const pdfBlob = await api.downloadFile(pdfUrl);
      zip.file(`${baseName}.pdf`, pdfBlob);

      // 2. Download photos
      const photos = visit.photos || [];
      if (photos.length > 0) {
        const photosFolder = zip.folder('Photos')!;
        for (const photo of photos) {
          try {
            const photoUrl = `/api/photos/${photo.id}/file`;
            const photoBlob = await api.downloadFile(photoUrl);
            photosFolder.file(photo.fileName, photoBlob);
          } catch (err) {
            console.warn(`Failed to download photo: ${photo.fileName}`, err);
          }
        }
      }

      // 3. Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${baseName}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      message.success('ZIP-архив скачан');
    } catch (err: any) {
      message.error(`Ошибка формирования отчёта: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card style={{ maxWidth: 500, width: '100%' }}>
        {generated ? (
          <>
            <Result
              status="success"
              title="Отчёт сформирован"
              subTitle={`Акт выполненных работ: ${visit?.requestNumber}`}
            />
            <Space style={{ width: '100%' }} direction="vertical" size="middle">
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleDownloadZip}
                loading={downloading}
                block
              >
                Скачать ZIP-архив
              </Button>
              <Button
                size="large"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/mtr/visits')}
                block
              >
                Вернуться к визитам
              </Button>
            </Space>
          </>
        ) : (
          <>
            <Result
              status="success"
              title="Визит завершён"
              subTitle={`Заявка: ${visit?.requestNumber}`}
            />
            <Space style={{ width: '100%' }} direction="vertical" size="middle">
              <Button
                type="primary"
                size="large"
                icon={<FilePdfOutlined />}
                onClick={handleGenerate}
                loading={generating}
                block
              >
                Сформировать отчёт
              </Button>
              <Button
                size="large"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/mtr/visits')}
                block
              >
                Вернуться к визитам
              </Button>
            </Space>
          </>
        )}
      </Card>
    </div>
  );
}
