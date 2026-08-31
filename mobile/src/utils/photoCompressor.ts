import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export interface CompressedPhoto {
  uri: string;
  width: number;
  height: number;
  size: number;
}

/**
 * Сжатие фото для AI-распознавания.
 * - Разрешение: 1280px по длинной стороне
 * - Качество JPEG: 0.65
 * - Целевой размер: ~100-200 КБ
 */
export async function compressPhoto(
  uri: string,
  maxSize: number = 1280,
  quality: number = 0.65
): Promise<CompressedPhoto> {
  // Получаем размеры исходного изображения
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('Файл не найден');
  }

  // Сжатие с масштабированием
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxSize } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  // Получаем размер сжатого файла
  const compressedInfo = await FileSystem.getInfoAsync(result.uri);
  
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    size: compressedInfo.exists ? compressedInfo.size : 0,
  };
}

/**
 * Генерация имени файла по шаблону:
 * {№}_{equipment_code}_{room_code}_{moment}.jpg
 */
export function generateFileName(
  taskNumber: number,
  equipmentCode: string,
  roomCode: string,
  moment: 'before' | 'after'
): string {
  const num = String(taskNumber).padStart(2, '0');
  const equip = equipmentCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  const room = roomCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${num}_${equip}_${room}_${moment}.jpg`;
}

/**
 * Копирование фото в директорию приложения с новым именем.
 */
export async function savePhotoToAppDir(
  sourceUri: string,
  fileName: string
): Promise<string> {
  const baseDir = FileSystem.documentDirectory ?? '';
  const appDir = baseDir + 'photos/';
  
  // Создаём директорию если не существует
  const dirInfo = await FileSystem.getInfoAsync(appDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(appDir, { intermediates: true });
  }
  
  const destUri = appDir + fileName;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  
  return destUri;
}

/**
 * Удаление фото из файловой системы.
 */
export async function deletePhoto(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri);
  }
}

/**
 * Получение размера файла в читаемом формате.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
