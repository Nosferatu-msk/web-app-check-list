import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { useAppTheme } from '../../../../../src/hooks/useAppTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CameraView from '../../../../../src/components/CameraView';
import { compressPhoto, generateFileName, savePhotoToAppDir, formatFileSize } from '../../../../../src/utils/photoCompressor';
import { useTask } from '../../../../../src/api/tasks';
import { useSyncMutation } from '../../../../../src/sync/mutations';
import { getDatabase } from '../../../../../src/db';
import CustomHeader from '../../../../../src/components/CustomHeader';
import { BOTTOM_PADDING_NESTED_SCREEN } from '../../../../../src/constants/layout';

const ONE_PHOTO_TYPES = new Set([
  'rsch', 'schetchik_gvs', 'schetchik_hvs', 'schetchik_electroshc',
  'seti_vodosnab', 'teplovye_seti', 'meter_gas',
]);

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
  const { savePhoto, deletePhoto } = useSyncMutation();
  const theme = useAppTheme();

  const [showCamera, setShowCamera] = useState(false);
  const [currentMoment, setCurrentMoment] = useState<'before' | 'after'>('before');
  const [photos, setPhotos] = useState<{ before: PhotoData | null; after: PhotoData | null }>({
    before: null,
    after: null,
  });
  const [loading, setLoading] = useState(true);

  // Загрузка сохранённых фото из SQLite
  useEffect(() => {
    (async () => {
      if (!taskId) return;
      try {
        const db = await getDatabase();
        const rows = await db.getAllAsync<any>(
          `SELECT * FROM photos WHERE task_id = ? ORDER BY created_at ASC`,
          [taskId]
        );
        const loaded: { before: PhotoData | null; after: PhotoData | null } = { before: null, after: null };
        for (const row of rows) {
          const moment = row.moment as 'before' | 'after';
          loaded[moment] = {
            id: row.id,
            uri: row.file_path,
            moment,
            fileName: row.file_name,
            size: 0,
            uploaded: row.uploaded === 1,
          };
        }
        setPhotos(loaded);
      } catch (e) {
        console.error('Error loading photos:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId]);

  const handleTakePhoto = async (uri: string) => {
    try {
      // Сжатие фото
      const compressed = await compressPhoto(uri, 1280, 0.65);

      // Генерация имени файла
      const fileName = generateFileName(
        1,
        task?.equipment_type_code || task?.equipment_type_name || 'equip',
        task?.room_type_code || task?.room_type_name || 'room',
        currentMoment
      );

      // Сохранение в директорию приложения
      const savedUri = await savePhotoToAppDir(compressed.uri, fileName);

      const photoId = `${taskId}_${currentMoment}_${Date.now()}`;
      const photoData: PhotoData = {
        id: photoId,
        uri: savedUri,
        moment: currentMoment,
        fileName,
        size: compressed.size,
        uploaded: false,
      };

      // Удаление старого фото этого момента (если есть)
      if (photos[currentMoment]) {
        await deletePhoto(photos[currentMoment]!.id);
      }

      // Сохранение в SQLite + sync queue
      await savePhoto({
        id: photoId,
        task_id: taskId!,
        moment: currentMoment,
        file_path: savedUri,
        file_name: fileName,
      });

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CustomHeader title="Фотофиксация" />
      <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleLarge" style={[styles.title, { color: theme.colors.text }]}>Фотофиксация</Text>
      <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.placeholder }]}>
        {task?.equipment_type_name}
      </Text>

      {/* Before */}
      <Surface style={[styles.photoCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.momentTitleRow}>
          <MaterialCommunityIcons name="camera" size={20} color={theme.colors.primary} />
          <Text variant="titleMedium" style={[styles.momentTitle, { color: theme.colors.text }]}>
            Фото ДО
          </Text>
        </View>
        {photos.before ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photos.before.uri }} style={[styles.image, { backgroundColor: theme.colors.border }]} />
            <Text variant="bodySmall" style={[styles.photoInfo, { color: theme.colors.placeholder }]}>
              {formatFileSize(photos.before.size)}
            </Text>
            <Button
              mode="outlined"
              onPress={() => handleRetake('before')}
              style={[styles.retakeButton, { borderColor: theme.colors.primary }]}
              accessibilityLabel="Переснять фото ДО"
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
              style={[styles.cameraButton, { backgroundColor: theme.colors.primary }]}
              accessibilityLabel="Сделать фото ДО"
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
              style={[styles.galleryButton, { borderColor: theme.colors.primary }]}
              accessibilityLabel="Выбрать фото ДО из галереи"
            >
              Из галереи
            </Button>
          </View>
        )}
      </Surface>

      {/* After — только для типов с 2 фото */}
      {!ONE_PHOTO_TYPES.has(task?.equipment_type_code || '') && (
      <Surface style={[styles.photoCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.momentTitleRow}>
          <MaterialCommunityIcons name="camera" size={20} color={theme.colors.primary} />
          <Text variant="titleMedium" style={[styles.momentTitle, { color: theme.colors.text }]}>
            Фото ПОСЛЕ
          </Text>
        </View>
        {photos.after ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photos.after.uri }} style={[styles.image, { backgroundColor: theme.colors.border }]} />
            <Text variant="bodySmall" style={[styles.photoInfo, { color: theme.colors.placeholder }]}>
              {formatFileSize(photos.after.size)}
            </Text>
            <Button
              mode="outlined"
              onPress={() => handleRetake('after')}
              style={[styles.retakeButton, { borderColor: theme.colors.primary }]}
              accessibilityLabel="Переснять фото ПОСЛЕ"
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
              style={[styles.cameraButton, { backgroundColor: theme.colors.primary }]}
              accessibilityLabel="Сделать фото ПОСЛЕ"
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
              style={[styles.galleryButton, { borderColor: theme.colors.primary }]}
              accessibilityLabel="Выбрать фото ПОСЛЕ из галереи"
            >
              Из галереи
            </Button>
          </View>
        )}
      </Surface>
      )}

      <View style={[styles.info, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="bodySmall" style={[styles.infoText, { color: theme.colors.placeholder }]}>
          Фото сжимается до ~150 КБ для быстрой загрузки.{'\n'}
          Разрешение: 1280px, JPEG quality 0.65
        </Text>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: BOTTOM_PADDING_NESTED_SCREEN,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 24,
  },
  photoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  momentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  momentTitle: {
    fontWeight: '600',
  },
  photoPreview: {
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 8,
  },
  photoInfo: {
    marginTop: 8,
  },
  retakeButton: {
    marginTop: 12,
  },
  photoPlaceholder: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  cameraButton: {
    marginBottom: 8,
    width: '100%',
  },
  galleryButton: {
    width: '100%',
  },
  info: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
