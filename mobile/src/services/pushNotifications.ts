import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import api from '../api/client';

/**
 * Запрашивает разрешения и регистрирует push-токен на сервере.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push-уведомления доступны только на физическом устройстве');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Основной',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F766E',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Разрешение на push-уведомления не получено');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '869c2b2e-8164-4ea0-834f-64bdef31e7df',
    });
    const token = tokenData.data;

    await api.post('/push/register', {
      token,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
    });

    return token;
  } catch (error) {
    console.error('Ошибка регистрации push-токена:', error);
    return null;
  }
}

/**
 * Настраивает обработчики входящих уведомлений.
 * - Foreground: отображает уведомление в статус-баре
 * - Tap: навигация к нужному экрану по данным из уведомления
 */
export function setupNotificationListeners() {
  // Показ уведомлений когда приложение на переднем плане
  Notifications.addNotificationReceivedListener((notification) => {
    // Уведомление отобразится автоматически — ничего дополнительного не нужно
  });

  // Обработка нажатия на уведомление
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    if (data?.visitId) {
      router.push(`/visit/${data.visitId}`);
    } else if (data?.requestId) {
      router.push(`/(tabs)/requests`);
    }
  });
}
