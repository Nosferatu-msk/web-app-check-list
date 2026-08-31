import { View, StyleSheet } from 'react-native';
import { Surface } from 'react-native-paper';

export default function VisitCardSkeleton() {
  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.header}>
        <View style={[styles.line, styles.addressLine]} />
        <View style={[styles.badge, styles.skeleton]} />
      </View>
      <View style={[styles.line, styles.dateLine]} />
      <View style={styles.progress}>
        <View style={[styles.line, styles.progressBar]} />
        <View style={[styles.line, styles.progressText]} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  line: {
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  addressLine: {
    width: '70%',
    height: 18,
  },
  dateLine: {
    width: '40%',
    marginTop: 12,
  },
  badge: {
    width: 70,
    height: 24,
    borderRadius: 6,
  },
  progress: {
    marginTop: 16,
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    width: '30%',
    marginTop: 8,
  },
  skeleton: {
    backgroundColor: '#E2E8F0',
  },
});
