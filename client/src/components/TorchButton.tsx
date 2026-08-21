import { useState, useEffect } from 'react';
import { Tooltip, Modal, App } from 'antd';
import { BulbOutlined, BulbFilled, WarningOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTorch } from '../hooks/useTorch';

export default function TorchButton() {
  const { message } = App.useApp();
  const { isOn, isSupported, error, toggle } = useTorch();
  const [showIosFallback, setShowIosFallback] = useState(false);
  const [overheatShown, setOverheatShown] = useState(false);

  // Battery warning on first enable
  const [batteryWarned, setBatteryWarned] = useState(false);

  // Overheat timer
  useEffect(() => {
    if (isOn && !overheatShown) {
      const timer = setTimeout(() => {
        message.warning('Фонарик работает более 15 мин. Рекомендуется выключить для предотвращения перегрева.');
        setOverheatShown(true);
      }, 15 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [isOn, overheatShown, message]);

  // Reset overheat flag when torch turns off
  useEffect(() => {
    if (!isOn) setOverheatShown(false);
  }, [isOn]);

  // Show error
  useEffect(() => {
    if (error) {
      if (error.includes('запрещён')) {
        Modal.warning({
          title: 'Доступ к камере',
          content: error,
        });
      } else {
        message.error(error);
      }
    }
  }, [error, message]);

  const handleClick = async () => {
    if (isSupported === false) {
      // Check if iOS — show fallback
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        setShowIosFallback(true);
      } else {
        message.info('Ваше устройство не поддерживает управление фонариком');
      }
      return;
    }

    // Battery check before enabling
    if (!isOn && !batteryWarned) {
      try {
        if ('getBattery' in navigator && navigator.getBattery) {
          const battery = await navigator.getBattery();
          if (battery.level < 0.05 && !battery.charging) {
            message.warning(`Низкий заряд: ${Math.round(battery.level * 100)}%. Фонарик может ускорить разряд.`);
            setBatteryWarned(true);
          }
        }
      } catch { /* Battery API unavailable — skip */ }
    }

    await toggle();
  };

  // Don't render if not supported and not mobile
  if (isSupported === false) {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile) return null;
    if (!isIOS) return null;
    // iOS — show button for fallback
  }

  if (isSupported === null) return null; // Still checking

  const getTooltip = (): string => {
    if (isOn) return 'Выключить фонарик';
    return 'Включить фонарик';
  };

  return (
    <>
      <Tooltip title={getTooltip()}>
        <span
          onClick={handleClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: isOn ? '#FEF3C7' : '#F1F5F9',
            cursor: 'pointer',
            fontSize: 20,
            color: isOn ? '#F59E0B' : '#94A3B8',
            transition: 'all 0.2s ease',
            userSelect: 'none',
            ...(isOn ? {
              boxShadow: '0 0 8px rgba(251, 191, 36, 0.5)',
            } : {}),
          }}
        >
          {isOn ? <BulbFilled /> : <BulbOutlined />}
        </span>
      </Tooltip>

      <Modal
        title={<><ThunderboltOutlined /> Фонарик</>}
        open={showIosFallback}
        onCancel={() => setShowIosFallback(false)}
        footer={null}
      >
        <p>Ваш браузер не поддерживает управление фонариком напрямую.</p>
        <p><strong>Включите фонарик через Пункт управления:</strong></p>
        <ol>
          <li>Свайп вниз из правого верхнего угла экрана</li>
          <li>Нажмите на иконку <ThunderboltOutlined /></li>
        </ol>
      </Modal>
    </>
  );
}
