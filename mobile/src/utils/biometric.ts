import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const PIN_CODE_KEY = 'pin_code';

/**
 * Проверка доступности биометрии на устройстве.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Аутентификация через биометрию (отпечаток/лицо).
 */
export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Разблокируйте приложение',
      fallbackLabel: 'Ввести PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch (error) {
    console.error('Biometric auth error:', error);
    return false;
  }
}

/**
 * Включить биометрию.
 */
export async function enableBiometric(): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
}

/**
 * Выключить биометрию.
 */
export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

/**
 * Проверка, включена ли биометрия.
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === 'true';
}

/**
 * Установить PIN-код.
 */
export async function setPinCode(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_CODE_KEY, pin);
}

/**
 * Проверить PIN-код.
 */
export async function verifyPinCode(pin: string): Promise<boolean> {
  const storedPin = await SecureStore.getItemAsync(PIN_CODE_KEY);
  return storedPin === pin;
}

/**
 * Проверка, установлен ли PIN-код.
 */
export async function isPinSet(): Promise<boolean> {
  const pin = await SecureStore.getItemAsync(PIN_CODE_KEY);
  return pin !== null;
}

/**
 * Удалить PIN-код.
 */
export async function removePinCode(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_CODE_KEY);
}
