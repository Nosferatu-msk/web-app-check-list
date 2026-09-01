import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { STATUS_BAR_HEIGHT, HEADER_HEIGHT, HEADER_BACK_SIZE, HEADER_TITLE_SIZE } from '../constants/layout';

interface CustomHeaderProps {
  title: string;
  onBack?: () => void;
}

export default function CustomHeader({ title, onBack }: CustomHeaderProps) {
  const theme = useAppTheme();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: STATUS_BAR_HEIGHT, backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HEADER_HEIGHT,
    paddingHorizontal: 12,
  },
  backButton: {
    width: HEADER_BACK_SIZE,
    height: HEADER_BACK_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: HEADER_TITLE_SIZE,
    fontWeight: '600',
  },
  spacer: {
    width: HEADER_BACK_SIZE,
  },
});
