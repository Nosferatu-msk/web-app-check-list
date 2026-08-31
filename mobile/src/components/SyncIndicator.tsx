import { View, StyleSheet, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSyncStore } from '../sync/engine';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';

export default function SyncIndicator() {
  const theme = useTheme();
  const status = useSyncStore((state) => state.status);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const error = useSyncStore((state) => state.error);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'syncing') {
      const animation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else {
      spinValue.setValue(0);
    }
  }, [status]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: 'rgba(220,38,38,0.1)' }]}>
        <MaterialCommunityIcons name="cloud-alert" size={16} color="#DC2626" />
        <Text style={[styles.text, { color: '#DC2626' }]}>Ошибка</Text>
      </View>
    );
  }

  if (status === 'syncing') {
    return (
      <View style={[styles.container, { backgroundColor: 'rgba(3,105,161,0.1)' }]}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <MaterialCommunityIcons name="sync" size={16} color="#0369A1" />
        </Animated.View>
        <Text style={[styles.text, { color: '#0369A1' }]}>Синхронизация...</Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <View style={[styles.container, { backgroundColor: 'rgba(217,119,6,0.1)' }]}>
        <MaterialCommunityIcons name="cloud-upload" size={16} color="#D97706" />
        <Text style={[styles.text, { color: '#D97706' }]}>
          {pendingCount} не отправлено
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(5,150,105,0.1)' }]}>
      <MaterialCommunityIcons name="check-circle" size={16} color="#059669" />
      <Text style={[styles.text, { color: '#059669' }]}>Синхронизировано</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
