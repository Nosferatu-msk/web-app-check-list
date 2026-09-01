import { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { Text, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { useAppTheme } from '../../../src/hooks/useAppTheme';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Pdf from 'react-native-pdf';
import { useVisit } from '../../../src/api/queries';
import api from '../../../src/api/client';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CustomHeader from '../../../src/components/CustomHeader';
import { BOTTOM_PADDING_NESTED_SCREEN } from '../../../src/constants/layout';

type ReportFormat = 'zip' | 'pdf';

export default function VisitReportScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const { data: visit } = useVisit(visitId);

  const [loading, setLoading] = useState(false);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [reportFormat, setReportFormat] = useState<ReportFormat>('zip');
  const [error, setError] = useState<string | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const theme = useAppTheme();

  const handleGenerateReport = async (format: ReportFormat = 'zip') => {
    setLoading(true);
    setError(null);
    setShowPdfViewer(false);

    try {
      // Формируем запрос в зависимости от формата
      const endpoint = format === 'zip'
        ? `/reports/${visitId}?format=zip`
        : `/reports/${visitId}`;

      const response = await api.get(endpoint, {
        responseType: 'arraybuffer',
      });

      // Сохраняем файл в файловую систему
      const base64 = btoa(
        new Uint8Array(response.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const ext = format === 'zip' ? 'zip' : 'pdf';
      const fileName = `report_${visitId}_${Date.now()}.${ext}`;
      const baseDir = FileSystem.documentDirectory ?? '';
      const filePath = baseDir + fileName;

      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setReportPath(filePath);
      setReportFormat(format);
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError('Не удалось сформировать отчёт. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!reportPath) return;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Недоступно', 'Функция поделиться недоступна на этом устройстве');
        return;
      }

      const mimeType = reportFormat === 'zip' ? 'application/zip' : 'application/pdf';

      await Sharing.shareAsync(reportPath, {
        mimeType,
        dialogTitle: 'Отправить отчёт',
      });
    } catch (err) {
      console.error('Error sharing:', err);
      Alert.alert('Ошибка', 'Не удалось отправить отчёт');
    }
  };

  const handleOpenInBrowser = async () => {
    if (!reportPath) return;

    try {
      await Linking.openURL(reportPath);
    } catch (err) {
      console.error('Error opening file:', err);
      Alert.alert('Ошибка', 'Не удалось открыть файл');
    }
  };

  const isZip = reportFormat === 'zip';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CustomHeader title="Отчёт" />
      <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.text }]}>Отчёт по визиту</Text>

      {visit && (
        <Surface style={[styles.infoCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={[styles.address, { color: theme.colors.text }]}>
            {visit.address}
          </Text>
          <Text variant="bodyMedium" style={[styles.date, { color: theme.colors.placeholder }]}>
            {new Date(visit.date).toLocaleDateString('ru-RU')} • {visit.time_start}
          </Text>
        </Surface>
      )}

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: 'rgba(220,38,38,0.08)' }]}>
          <MaterialCommunityIcons name="alert-circle" size={24} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>Формирование отчёта...</Text>
        </View>
      )}

      {!loading && !reportPath && (
        <View style={styles.generateButtons}>
          <Button
            mode="contained"
            onPress={() => handleGenerateReport('zip')}
            icon="file-document-arrow-right"
            style={[styles.generateButton, { backgroundColor: theme.colors.primary }]}
            contentStyle={styles.generateButtonContent}
          >
            Сформировать отчёт (ZIP)
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleGenerateReport('pdf')}
            icon="file-pdf-box"
            style={[styles.generateButton, { borderColor: theme.colors.primary }]}
            textColor={theme.colors.primary}
            contentStyle={styles.generateButtonContent}
          >
            Только PDF
          </Button>
        </View>
      )}

      {reportPath && (
        <View style={styles.reportActions}>
          <Surface style={[styles.successCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <MaterialCommunityIcons
              name={isZip ? 'zip-box' : 'check-circle'}
              size={48}
              color={theme.colors.success}
            />
            <Text variant="titleMedium" style={[styles.successText, { color: theme.colors.text }]}>
              Отчёт сформирован
            </Text>
            <Text variant="bodySmall" style={[styles.successSubtext, { color: theme.colors.placeholder }]}>
              {isZip ? 'Отчёт с фото готов к отправке' : 'PDF готов к отправке'}
            </Text>
          </Surface>

          <Button
            mode="contained"
            onPress={handleShare}
            icon="share-variant"
            style={[styles.shareButton, { backgroundColor: theme.colors.primary }]}
            contentStyle={styles.buttonContent}
          >
            {isZip ? 'Отправить ZIP' : 'Отправить PDF'}
          </Button>

          {isZip ? (
            <View style={[styles.zipInfoCard, { backgroundColor: theme.colors.surface }]}>
              <MaterialCommunityIcons name="zip-box" size={24} color={theme.colors.placeholder} />
              <Text variant="bodyMedium" style={[styles.zipInfoText, { color: theme.colors.placeholder }]}>
                ZIP-архив содержит PDF-отчёт и фотографии. Откройте в почтовом клиенте для просмотра PDF.
              </Text>
            </View>
          ) : (
            <>
              <Button
                mode="outlined"
                onPress={() => setShowPdfViewer(!showPdfViewer)}
                icon={showPdfViewer ? 'eye-off' : 'eye'}
                style={[styles.viewButton, { borderColor: theme.colors.primary }]}
              >
                {showPdfViewer ? 'Скрыть PDF' : 'Просмотреть PDF'}
              </Button>

              {showPdfViewer && reportPath && (
                <View style={styles.pdfContainer}>
                  <Pdf
                    source={{ uri: reportPath }}
                    style={styles.pdf}
                    trustAllCerts={false}
                    onError={() => Alert.alert('Ошибка', 'Не удалось открыть PDF')}
                  />
                </View>
              )}
            </>
          )}

          <Button
            mode="text"
            onPress={() => {
              setReportPath(null);
              setError(null);
              setShowPdfViewer(false);
            }}
            textColor={theme.colors.placeholder}
          >
            Сформировать заново
          </Button>
        </View>
      )}
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
    marginBottom: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  address: {
    fontWeight: '600',
  },
  date: {
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
  },
  generateButtons: {
    gap: 12,
    marginTop: 8,
  },
  generateButton: {
    marginTop: 0,
  },
  generateButtonContent: {
    height: 48,
  },
  reportActions: {
    marginTop: 16,
  },
  successCard: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  successText: {
    marginTop: 12,
    fontWeight: '600',
  },
  successSubtext: {
    marginTop: 4,
  },
  shareButton: {
    marginBottom: 12,
  },
  buttonContent: {
    height: 48,
  },
  viewButton: {
    marginBottom: 12,
  },
  zipInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
  },
  zipInfoText: {
    flex: 1,
  },
  pdfContainer: {
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 12,
  },
  pdf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
