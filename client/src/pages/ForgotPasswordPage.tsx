import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, App, Card } from 'antd';
import { api } from '../api/client';

export default function ForgotPasswordPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    try {
      await api.forgotPassword(values.email);
      setSent(true);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">Восстановление пароля</div>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <p>Если email зарегистрирован, письмо для сброса пароля отправлено.</p>
            <Link to="/login"><Button type="link">Вернуться ко входу</Button></Link>
          </div>
        ) : (
          <Form onFinish={onFinish} layout="vertical" size="large">
            <Form.Item name="email" rules={[{ required: true, message: 'Введите email' }]}>
              <Input placeholder="Email" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>Отправить ссылку</Button>
            </Form.Item>
            <div style={{ textAlign: 'center' }}><Link to="/login">Вернуться ко входу</Link></div>
          </Form>
        )}
      </div>
    </div>
  );
}
