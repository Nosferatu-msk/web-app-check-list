import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { CameraView as ExpoCameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CameraScreenProps {
  onPhotoTaken: (uri: string) => void;
  onClose: () => void;
}

const CONSENT_KEY = 'camera_152_consent';

export default function CameraScreen({ onPhotoTaken, onClose }: CameraScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [showConsent, setShowConsent] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const cameraRef = useRef<ExpoCameraView>(null);

  // Запрос разрешения при первом действии
  const handleFirstAction = async () => {
    if (!permission?.granted) {
      await requestPermission();
    }
  };

  useEffect(() => {
    if (permission?.granted) {
      handleFirstAction();
    }
  }, [permission?.granted]);

  const checkConsent = async () => {
    const consent = await SecureStore.getItemAsync(CONSENT_KEY);
    if (!consent) {
      setShowConsent(true);
      return false;
    }
    return true;
  };

  const handleConsentAccept = async () => {
    await SecureStore.setItemAsync(CONSENT_KEY, 'true');
    setShowConsent(false);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    // Проверяем согласие при первом фото
    const hasConsent = await checkConsent();
    if (!hasConsent) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: true,
      });
      if (photo?.uri) {
        onPhotoTaken(photo.uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  const toggleFlash = () => {
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // Запрос разрешения
  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Нет доступа к камере</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Разрешить</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Закрыть</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Предупреждение 152-ФЗ
  if (showConsent) {
    return (
      <View style={styles.consentContainer}>
        <View style={styles.consentCard}>
          <MaterialCommunityIcons name="shield-alert" size={48} color="#D97706" />
          <Text style={styles.consentTitle}>ВНИМАНИЕ!</Text>
          <Text style={styles.consentText}>
            Убедитесь, что в кадр не попали:{'\n'}
            • Лица посетителей{'\n'}
            • Персональные данные на мониторах{'\n'}
            • Банковские карты и документы
          </Text>
          <TouchableOpacity style={styles.consentButton} onPress={handleConsentAccept}>
            <Text style={styles.consentButtonText}>Понятно, сделать фото</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowConsent(false)}>
            <Text style={styles.consentCancel}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoCameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      >
        {/* Верхняя панель */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.controlButton} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
            <MaterialCommunityIcons 
              name={flash === 'off' ? 'flash-off' : 'flash'} 
              size={28} 
              color={flash === 'off' ? '#FFFFFF' : '#FFD700'} 
            />
          </TouchableOpacity>
        </View>

        {/* Нижняя панель */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleFacing}>
            <MaterialCommunityIcons name="camera-switch" size={32} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutterButton} onPress={takePicture}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <View style={styles.controlButton} />
        </View>
      </ExpoCameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
  },
  consentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 16,
    marginBottom: 12,
  },
  consentText: {
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  consentButton: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  consentButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  consentCancel: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 12,
  },
  permissionButton: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 12,
  },
  closeButtonText: {
    color: '#64748B',
    fontSize: 14,
  },
});
