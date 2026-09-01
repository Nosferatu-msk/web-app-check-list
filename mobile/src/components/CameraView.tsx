import { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, PanResponder, Alert } from 'react-native';
import { CameraView as ExpoCameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { useAppTheme } from '../hooks/useAppTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CameraScreenProps {
  onPhotoTaken: (uri: string) => void;
  onClose: () => void;
}

const CONSENT_KEY = 'camera_152_consent';

export default function CameraScreen({ onPhotoTaken, onClose }: CameraScreenProps) {
  const theme = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0);
  const [focusIndicator, setFocusIndicator] = useState<{ x: number; y: number } | null>(null);
  const cameraRef = useRef<ExpoCameraView>(null);
  const zoomRef = useRef(0);

  // Pinch-to-zoom через PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const newZoom = Math.max(0, Math.min(1, zoomRef.current - gestureState.dy * 0.005));
        zoomRef.current = newZoom;
        setZoom(newZoom);
      },
      onPanResponderRelease: () => {
        zoomRef.current = zoom;
      },
    })
  ).current;

  // Focus-by-tap
  const handleCameraTap = useCallback((event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setFocusIndicator({ x: locationX, y: locationY });
    setTimeout(() => setFocusIndicator(null), 1000);
  }, []);

  useEffect(() => {
    (async () => {
      const consent = await SecureStore.getItemAsync(CONSENT_KEY);
      if (!consent) {
        setShowConsent(true);
      }
      setConsentChecked(true);
    })();
  }, []);

  const handleConsentAccept = async () => {
    await SecureStore.setItemAsync(CONSENT_KEY, 'true');
    setShowConsent(false);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      // Проверка свободного места (минимум 50 МБ)
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      if (freeSpace < 50 * 1024 * 1024) {
        Alert.alert('Недостаточно места', 'Недостаточно места для сохранения фото. Освободите минимум 50 МБ.');
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: true,
      });
      if (photo?.uri) {
        onPhotoTaken(photo.uri);
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('camera is currently in use') || msg.includes('Camera is busy')) {
        Alert.alert('Камера недоступна', 'Камера занята другим приложением. Закройте другое приложение и попробуйте снова.');
      } else if (msg.includes('Could not') || msg.includes('Failed')) {
        Alert.alert('Ошибка съёмки', 'Не удалось сделать фото. Попробуйте ещё раз.');
      } else {
        Alert.alert('Ошибка', 'Не удалось сделать фото. Попробуйте ещё раз.');
      }
    }
  };

  const toggleFlash = () => {
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // 1. Предупреждение 152-ФЗ — ПОКАЗЫВАЕТСЯ ДО КАМЕРЫ
  if (!consentChecked || showConsent) {
    return (
      <View style={styles.consentContainer}>
        <View style={[styles.consentCard, { backgroundColor: theme.colors.surface }]}>
          <MaterialCommunityIcons name="shield-alert" size={48} color={theme.colors.warning} />
          <Text style={[styles.consentTitle, { color: theme.colors.warning }]}>ВНИМАНИЕ!</Text>
          <Text style={[styles.consentText, { color: theme.colors.text }]}>
            Убедитесь, что в кадр не попали:{'\n'}
            • Лица посетителей{'\n'}
            • Персональные данные на мониторах{'\n'}
            • Банковские карты и документы
          </Text>
          <TouchableOpacity style={[styles.consentButton, { backgroundColor: theme.colors.primary }]} onPress={handleConsentAccept}>
            <Text style={[styles.consentButtonText, { color: theme.colors.surface }]}>Понятно, сделать фото</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.consentCancelBtn} onPress={onClose}>
            <Text style={[styles.consentCancel, { color: theme.colors.placeholder }]}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. Запрос разрешения на камеру (после согласия)
  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.consentContainer}>
          <View style={[styles.consentCard, { backgroundColor: theme.colors.surface }]}>
            <MaterialCommunityIcons name="camera-off" size={48} color={theme.colors.placeholder} />
            <Text style={[styles.consentTitle, { color: theme.colors.warning }]}>Доступ к камере</Text>
            <Text style={[styles.consentText, { color: theme.colors.text }]}>
              Разрешите доступ к камере для фотофиксации оборудования
            </Text>
            <TouchableOpacity style={[styles.consentButton, { backgroundColor: theme.colors.primary }]} onPress={requestPermission}>
              <Text style={[styles.consentButtonText, { color: theme.colors.surface }]}>Разрешить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.consentCancelBtn} onPress={onClose}>
              <Text style={[styles.consentCancel, { color: theme.colors.placeholder }]}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // 3. Камера
  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer} {...panResponder.panHandlers}>
        <ExpoCameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash={flash}
          zoom={zoom}
        >
          {/* Индикатор фокуса */}
          {focusIndicator && (
            <View style={[styles.focusIndicator, { left: focusIndicator.x - 30, top: focusIndicator.y - 30 }]} />
          )}

          {/* Верхняя панель */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.controlButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть камеру">
              <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash} accessibilityRole="button" accessibilityLabel={flash === 'off' ? 'Включить фонарик' : 'Выключить фонарик'}>
              <MaterialCommunityIcons
                name={flash === 'off' ? 'flash-off' : 'flash'}
                size={28}
                color={flash === 'off' ? '#FFFFFF' : '#FFD700'}
              />
            </TouchableOpacity>
          </View>

          {/* Нижняя панель */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleFacing} accessibilityRole="button" accessibilityLabel="Переключить камеру">
              <MaterialCommunityIcons name="camera-switch" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.shutterButton} onPress={takePicture} accessibilityRole="button" accessibilityLabel="Сделать фото">
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <View style={styles.controlButton} />
          </View>
        </ExpoCameraView>

        {/* Tap-to-focus overlay */}
        <View style={styles.tapOverlay} onTouchEnd={handleCameraTap} pointerEvents="box-none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  focusIndicator: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: 'transparent',
  },
  tapOverlay: {
    ...StyleSheet.absoluteFill,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controlButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  // Consent styles
  consentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
  },
  consentCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
  },
  consentTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
  },
  consentText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  consentButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  consentButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  consentCancelBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  consentCancel: {
    fontSize: 14,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 12,
  },
  closeButtonText: {
    fontSize: 14,
  },
});
