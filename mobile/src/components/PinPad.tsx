import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';

interface PinPadProps {
  pin: string;
  maxLength?: number;
  onDigitPress: (digit: string) => void;
  onDeletePress: () => void;
}

export default function PinPad({ pin, maxLength = 6, onDigitPress, onDeletePress }: PinPadProps) {
  const theme = useAppTheme();

  const dots = Array.from({ length: maxLength }, (_, i) => i < pin.length);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  const handlePress = (key: string) => {
    if (key === '') return;
    if (key === 'del') {
      onDeletePress();
      return;
    }
    if (pin.length < maxLength) {
      onDigitPress(key);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {dots.map((filled, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: theme.colors.border },
              filled && [styles.dotFilled, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
            ]}
          />
        ))}
      </View>

      <View style={styles.pad}>
        {keys.map((key, i) => {
          if (key === '') {
            return <View key={i} style={styles.key} />;
          }
          if (key === 'del') {
            return (
              <TouchableOpacity key={i} style={styles.key} onPress={() => handlePress('del')} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel="Удалить цифру">
                <MaterialCommunityIcons name="backspace-outline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity key={i} style={[styles.key, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => handlePress(key)} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel={`Цифра ${key}`}>
              <Text style={[styles.keyText, { color: theme.colors.text }]}>{key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  dotFilled: {
    borderColor: '#0F766E',
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 240,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
  },
});
