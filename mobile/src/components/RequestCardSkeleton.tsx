import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Surface } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';

export default function RequestCardSkeleton() {
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
          <View style={[styles.line, styles.numberLine, { backgroundColor: theme.colors.border }]} />
          <View style={[styles.line, styles.statusBadge]} />
        </View>
        <View style={[styles.line, styles.addressLine, { backgroundColor: theme.colors.border }]} />
        <View style={[styles.line, styles.equipLine, { backgroundColor: theme.colors.border }]} />
        <View style={[styles.line, styles.buttonLine, { backgroundColor: theme.colors.border }]} />
      </Surface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  line: {
    height: 14,
    borderRadius: 4,
  },
  numberLine: {
    width: 100,
    height: 18,
  },
  statusBadge: {
    width: 72,
    height: 24,
    borderRadius: 8,
  },
  addressLine: {
    width: '70%',
    marginBottom: 6,
  },
  equipLine: {
    width: '40%',
    marginBottom: 12,
  },
  buttonLine: {
    width: 120,
    height: 32,
    borderRadius: 8,
  },
});
