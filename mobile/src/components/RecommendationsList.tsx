import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRecommendations, Recommendation } from '../api/tasks';

interface RecommendationsListProps {
  equipmentTypeCode?: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function RecommendationsList({
  equipmentTypeCode,
  selectedIds,
  onSelectionChange,
}: RecommendationsListProps) {
  const theme = useAppTheme();
  const { data: recommendations, isLoading } = useRecommendations(equipmentTypeCode);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <View style={styles.container}>
      {recommendations.map((rec) => {
        const isSelected = selectedIds.includes(rec.id);
        return (
          <TouchableOpacity
            key={rec.id}
            style={[styles.item, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, isSelected && styles.itemSelected, isSelected && { borderColor: theme.colors.primary, backgroundColor: 'rgba(15,118,110,0.04)' }]}
            onPress={() => toggle(rec.id)}
            activeOpacity={0.7}
            hitSlop={{ top: 13, bottom: 13 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={rec.text}
          >
            <View style={[styles.checkbox, { borderColor: theme.colors.placeholder }, isSelected && styles.checkboxSelected, isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
              {isSelected && (
                <MaterialCommunityIcons name="check" size={14} color={theme.colors.surface} />
              )}
            </View>
            <Text style={[styles.text, { color: theme.colors.text }, isSelected && styles.textSelected, isSelected && { color: theme.colors.primary }]} numberOfLines={3}>
              {rec.text}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  loading: {
    padding: 16,
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  itemSelected: {
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxSelected: {
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  textSelected: {
    fontWeight: '500',
  },
});
