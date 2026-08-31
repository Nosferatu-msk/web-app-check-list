import { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Platform, Alert } from 'react-native';
import { Text, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useVisit } from '../../../src/api/queries';
import api from '../../../src/api/client';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function VisitReportScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const { data: visit } = useVisit(visitId);

  const [loading, setLoading] = useState(false);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      // Запрашиваем генерацию отчёта с сервера
      const response = await api.get(`/reports/${visitId}`, {
        responseType: 'arraybuffer',
      });

      // Сохраняем PDF в файловую систему
      const base64 = btoa(
        new Uint8Array(response.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const fileName = `report_${visitId}_${Date.now()}.pdf`;
      const baseDir = FileSystem.documentDirectory ?? '';
      const filePath = baseDir + fileName;

      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setReportPath(filePath);
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

      await Sharing.shareAsync(reportPath, {
        mimeType: 'application/pdf',
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
      console.error('Error opening PDF:', err);
      Alert.alert('Ошибка', 'Не удалось открыть PDF');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>Отчёт по визиту</Text>
      
      {visit && (
        <Surface style={styles.infoCard} elevation={1}>
          <Text variant="titleMedium" style={styles.address}>
            {visit.address}
          </Text>
          <Text variant="bodyMedium" style={styles.date}>
            {new Date(visit.date).toLocaleDateString('ru-RU')} • {visit.time_start}
          </Text>
        </Surface>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0F766E" />
          <Text style={styles.loadingText}>Формирование отчёта...</Text>
        </View>
      )}

      {!loading && !reportPath && (
        <Button
          mode="contained"
          onPress={handleGenerateReport}
          icon="file-pdf-box"
          style={styles.generateButton}
          contentStyle={styles.generateButtonContent}
        >
          Сформировать отчёт
        </Button>
      )}

      {reportPath && (
        <View style={styles.reportActions}>
          <Surface style={styles.successCard} elevation={1}>
            <MaterialCommunityIcons name="check-circle" size={48} color="#059669" />
            <Text variant="titleMedium" style={styles.successText}>
              Отчёт сформирован
            </Text>
            <Text variant="bodySmall" style={styles.successSubtext}>
              PDF готов к отправке
            </Text>
          </Surface>

          <Button
            mode="contained"
            onPress={handleShare}
            icon="share-variant"
            style={styles.shareButton}
            contentStyle={styles.buttonContent}
          >
            Отправить отчёт
          </Button>

          <Button
            mode="outlined"
            onPress={handleOpenInBrowser}
            icon="eye"
            style={styles.viewButton}
          >
            Просмотреть PDF
          </Button>

          <Button
            mode="text"
            onPress={() => {
              setReportPath(null);
              setError(null);
            }}
            textColor="#64748B"
          >
            Сформировать заново
          </Button>
        </View>
      )}
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
    marginBottom: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  address: {
    fontWeight: '600',
    color: '#0F172A',
  },
  date: {
    color: '#64748B',
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
  },
  generateButton: {
    backgroundColor: '#0F766E',
    marginTop: 16,
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
    color: '#0F172A',
  },
  successSubtext: {
    marginTop: 4,
    color: '#64748B',
  },
  shareButton: {
    backgroundColor: '#0F766E',
    marginBottom: 12,
  },
  buttonContent: {
    height: 48,
  },
  viewButton: {
    borderColor: '#0F766E',
    marginBottom: 12,
  },
  regenerateButton: {
    color: '#64748B',
  },
});
