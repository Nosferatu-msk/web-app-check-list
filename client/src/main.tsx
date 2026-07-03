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
      <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: '#1677ff' } }}>
        <AntApp>
          <App />
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
