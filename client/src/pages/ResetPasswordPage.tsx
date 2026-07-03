import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, App } from 'antd';
import { api } from '../api/client';

export default function ResetPasswordPage() {
  const { message } = App.useApp();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { password: string }) => {
    if (!token) { message.error('Неверная ссылка'); return; }
    setLoading(true);
    try {
      await api.resetPassword(token, values.password);
      message.success('Пароль изменён');
      navigate('/login');
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">Новый пароль</div>
        <Form onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="password" rules={[{ required: true, message: 'Введите пароль' }, { min: 6, message: 'Минимум 6 символов' }]}>
            <Input.Password placeholder="Новый пароль" />
          </Form.Item>
          <Form.Item name="confirm" dependencies={['password']} rules={[
            { required: true, message: 'Подтвердите пароль' },
            ({ getFieldValue }) => ({ validator(_, v) { return v === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('Пароли не совпадают')); } }),
          ]}>
            <Input.Password placeholder="Подтвердите пароль" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>Сменить пароль</Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}><Link to="/login">Вернуться ко входу</Link></div>
        </Form>
      </div>
    </div>
  );
}
