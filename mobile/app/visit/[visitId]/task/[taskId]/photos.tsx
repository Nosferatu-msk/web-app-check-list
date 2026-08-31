import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import CameraView from '../../../../../src/components/CameraView';
import { compressPhoto, generateFileName, savePhotoToAppDir, formatFileSize } from '../../../../../src/utils/photoCompressor';
import { useTask } from '../../../../../src/api/tasks';

interface PhotoData {
  id: string;
  uri: string;
  moment: 'before' | 'after';
  fileName: string;
  size: number;
  uploaded: boolean;
}

export default function TaskPhotosScreen() {
  const { visitId, taskId } = useLocalSearchParams<{ visitId: string; taskId: string }>();
  const router = useRouter();
  const { data: task } = useTask(visitId, taskId);

  const [showCamera, setShowCamera] = useState(false);
  const [currentMoment, setCurrentMoment] = useState<'before' | 'after'>('before');
  const [photos, setPhotos] = useState<{ before: PhotoData | null; after: PhotoData | null }>({
    before: null,
    after: null,
  });

  const handleTakePhoto = async (uri: string) => {
    try {
      // Сжатие фото
      const compressed = await compressPhoto(uri, 1280, 0.65);
      
      // Генерация имени файла
      const fileName = generateFileName(
        1, // TODO: получить номер задачи
        task?.equipment_type_name || 'equip',
        task?.room_type_name || 'room',
        currentMoment
      );
      
      // Сохранение в директорию приложения
      const savedUri = await savePhotoToAppDir(compressed.uri, fileName);
      
      const photoData: PhotoData = {
        id: `${taskId}_${currentMoment}_${Date.now()}`,
        uri: savedUri,
        moment: currentMoment,
        fileName,
        size: compressed.size,
        uploaded: false,
      };
      
      setPhotos((prev) => ({
        ...prev,
        [currentMoment]: photoData,
      }));
      
      setShowCamera(false);
    } catch (error) {
      console.error('Error processing photo:', error);
      Alert.alert('Ошибка', 'Не удалось обработать фото');
    }
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.65,
    });

    if (!result.canceled && result.assets[0]) {
      // Проверка EXIF даты
      const asset = result.assets[0];
      const photoDate = asset.exif?.DateTimeOriginal;
      if (photoDate) {
        const takenDate = new Date(photoDate);
        const now = new Date();
        const hoursDiff = (now.getTime() - takenDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
          Alert.alert(
            'Старое фото',
            'Фото сделано более 24 часов назад. Продолжить?',
            [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Продолжить', onPress: () => handleTakePhoto(asset.uri) },
            ]
          );
          return;
        }
      }
      
      handleTakePhoto(asset.uri);
    }
  };

  const handleRetake = (moment: 'before' | 'after') => {
    setCurrentMoment(moment);
    setShowCamera(true);
  };

  if (showCamera) {
    return (
      <CameraView
        onPhotoTaken={handleTakePhoto}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="titleLarge" style={styles.title}>Фотофиксация</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {task?.equipment_type_name}
      </Text>

      {/* Before */}
      <Surface style={styles.photoCard} elevation={1}>
        <Text variant="titleMedium" style={styles.momentTitle}>
          📷 Фото ДО
        </Text>
        {photos.before ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photos.before.uri }} style={styles.image} />
            <Text variant="bodySmall" style={styles.photoInfo}>
              {formatFileSize(photos.before.size)}
            </Text>
            <Button
              mode="outlined"
              onPress={() => handleRetake('before')}
              style={styles.retakeButton}
            >
              Переснять
            </Button>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Button
              mode="contained"
              onPress={() => {
                setCurrentMoment('before');
                setShowCamera(true);
              }}
              icon="camera"
              style={styles.cameraButton}
            >
              Сделать фото
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setCurrentMoment('before');
                handlePickFromGallery();
              }}
              icon="image"
              style={styles.galleryButton}
            >
              Из галереи
            </Button>
          </View>
        )}
      </Surface>

      {/* After */}
      <Surface style={styles.photoCard} elevation={1}>
        <Text variant="titleMedium" style={styles.momentTitle}>
          📷 Фото ПОСЛЕ
        </Text>
        {photos.after ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photos.after.uri }} style={styles.image} />
            <Text variant="bodySmall" style={styles.photoInfo}>
              {formatFileSize(photos.after.size)}
            </Text>
            <Button
              mode="outlined"
              onPress={() => handleRetake('after')}
              style={styles.retakeButton}
            >
              Переснять
            </Button>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Button
              mode="contained"
              onPress={() => {
                setCurrentMoment('after');
                setShowCamera(true);
              }}
              icon="camera"
              style={styles.cameraButton}
            >
              Сделать фото
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setCurrentMoment('after');
                handlePickFromGallery();
              }}
              icon="image"
              style={styles.galleryButton}
            >
              Из галереи
            </Button>
          </View>
        )}
      </Surface>

      <View style={styles.info}>
        <Text variant="bodySmall" style={styles.infoText}>
          Фото сжимается до ~150 КБ для быстрой загрузки.{'\n'}
          Разрешение: 1280px, JPEG quality 0.65
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  title: {
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    color: '#64748B',
    marginBottom: 24,
  },
  photoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  momentTitle: {
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  photoPreview: {
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  photoInfo: {
    color: '#64748B',
    marginTop: 8,
  },
  retakeButton: {
    marginTop: 12,
    borderColor: '#0F766E',
  },
  photoPlaceholder: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  cameraButton: {
    backgroundColor: '#0F766E',
    marginBottom: 8,
    width: '100%',
  },
  galleryButton: {
    borderColor: '#0F766E',
    width: '100%',
  },
  info: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  infoText: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
