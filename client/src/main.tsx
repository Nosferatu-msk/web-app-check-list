import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        locale={ruRU}
        theme={{
          token: {
            // Основные цвета
            colorPrimary: '#0F766E',
            colorSuccess: '#059669',
            colorWarning: '#D97706',
            colorError: '#DC2626',
            colorInfo: '#0369A1',
            // Фон и текст
            colorBgBase: '#F8FAFC',
            colorText: '#0F172A',
            colorTextSecondary: '#475569',
            colorBorder: '#E2E8F0',
            colorBorderSecondary: '#F1F5F9',
            // Формы
            borderRadius: 10,
            borderRadiusLG: 12,
            controlHeight: 40,
          },
          components: {
            Button: {
              controlHeight: 44,
              borderRadius: 10,
            },
            Card: {
              borderRadiusLG: 12,
            },
            Input: {
              borderRadius: 10,
              activeBorderColor: '#0F766E',
            },
            Select: {
              borderRadius: 10,
            },
            Table: {
              borderRadius: 12,
              headerBg: '#F8FAFC',
              headerColor: '#475569',
            },
            Modal: {
              borderRadiusLG: 16,
            },
            Menu: {
              itemBorderRadius: 6,
              itemMarginInline: 8,
            },
            Tag: {
              borderRadiusSM: 6,
            },
          },
        }}
      >
        <AntApp>
          <App />
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
