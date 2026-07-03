import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, App } from 'antd';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      navigate('/');
    } catch (err: any) {
      message.error(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">🔧 Чек-лист инженера</div>
        <div className="login-subtitle">Цифровой чек-лист ТО оборудования</div>
        <Form onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="email" rules={[{ required: true, message: 'Введите email' }, { type: 'email', message: 'Некорректный email' }]}>
            <Input placeholder="Email" autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Введите пароль' }]}>
            <Input.Password placeholder="Пароль" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>Войти</Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Link to="/forgot-password">Забыли пароль?</Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
