import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Surface } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';

export default function VisitCardSkeleton() {
  const theme = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true, easing: Easing.ease }),
        Animated.timing(opacity, { toValue: 0.3, duration: 300, useNativeDriver: true, easing: Easing.ease }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View style={{ opacity }}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.header}>
          <View style={styles.content}>
            <View style={[styles.line, styles.addressLine, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.line, styles.dateLine]} />
          </View>
          <View style={[styles.line, styles.badge]} />
        </View>
        <View style={styles.progress}>
          <View style={[styles.line, styles.progressBar]} />
          <View style={[styles.line, styles.progressText]} />
        </View>
      </Surface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    borderRadius: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  line: {
    height: 14,
    borderRadius: 4,
  },
  addressLine: {
    width: '85%',
    height: 18,
    marginBottom: 8,
  },
  dateLine: {
    width: '45%',
  },
  badge: {
    width: 72,
    height: 24,
    borderRadius: 12,
  },
  progress: {
    marginTop: 14,
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    width: '30%',
    marginTop: 6,
    height: 12,
  },
});
