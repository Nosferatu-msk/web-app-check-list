import { useState, useCallback } from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useAppTheme } from '../hooks/useAppTheme';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
}

export default function VoiceInputButton({ onTranscript }: VoiceInputButtonProps) {
  const theme = useAppTheme();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  useSpeechRecognitionEvent('result', (event) => {
    const text = event?.results?.[0]?.transcript || '';
    setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    if (transcript) {
      onTranscript(transcript);
      setTranscript('');
    }
  });

  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
  });

  const startListening = useCallback(async () => {
    try {
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к микрофону для голосового ввода');
        return;
      }

      setTranscript('');
      setIsListening(true);

      ExpoSpeechRecognitionModule.start({
        lang: 'ru-RU',
      });
    } catch (error) {
      setIsListening(false);
      Alert.alert('Ошибка', 'Не удалось запустить голосовой ввод.');
    }
  }, []);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, []);

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: isListening ? theme.colors.error : theme.colors.primary }]}
      onPress={isListening ? stopListening : startListening}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isListening ? 'Остановить запись' : 'Голосовой ввод'}
    >
      <MaterialCommunityIcons
        name={isListening ? 'microphone' : 'microphone-outline'}
        size={18}
        color="#FFFFFF"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
