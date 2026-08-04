import { useParams, useNavigate } from 'react-router-dom';
import { Result, Button, Space, App } from 'antd';
import { FilePdfOutlined, ArrowLeftOutlined } from '@ant-design/icons';

export default function MtrReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const handleGenerateReport = () => {
    message.info('Формирование отчёта для МТР находится в разработке');
  };

  return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Result
        status="success"
        title="Визит завершён"
        subTitle="Визит отправлен на проверку территориальному менеджеру"
        extra={
          <Space direction="vertical" size="middle" style={{ width: '100%', maxWidth: 300 }}>
            <Button
              type="primary"
              size="large"
              icon={<FilePdfOutlined />}
              onClick={handleGenerateReport}
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
        }
      />
    </div>
  );
}
