import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  isBiometricAvailable,
  authenticateWithBiometric,
  enableBiometric,
  disableBiometric,
  isBiometricEnabled,
  setPinCode,
  verifyPinCode,
  isPinSet,
  removePinCode,
} from '../src/utils/biometric';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isBiometricAvailable', () => {
  test('возвращает true когда есть железо и enrollment', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);

    expect(await isBiometricAvailable()).toBe(true);
  });

  test('возвращает false когда нет железа', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);

    expect(await isBiometricAvailable()).toBe(false);
    expect(LocalAuthentication.isEnrolledAsync).not.toHaveBeenCalled();
  });

  test('возвращает false когда нет enrollment', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);

    expect(await isBiometricAvailable()).toBe(false);
  });
});

describe('authenticateWithBiometric', () => {
  test('возвращает true при успешной аутентификации', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

    expect(await authenticateWithBiometric()).toBe(true);
  });

  test('возвращает false при неудачной аутентификации', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });

    expect(await authenticateWithBiometric()).toBe(false);
  });

  test('возвращает false при ошибке', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValue(new Error('fail'));

    expect(await authenticateWithBiometric()).toBe(false);
  });

  test('передаёт правильные параметры', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

    await authenticateWithBiometric();

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Разблокируйте приложение',
      fallbackLabel: 'Ввести PIN',
      disableDeviceFallback: true,
    });
  });
});

describe('biometric enable/disable', () => {
  test('enableBiometric сохраняет true в SecureStore', async () => {
    await enableBiometric();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometric_enabled', 'true');
  });

  test('disableBiometric удаляет из SecureStore', async () => {
    await disableBiometric();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_enabled');
  });

  test('isBiometricEnabled возвращает true когда сохранено true', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
    expect(await isBiometricEnabled()).toBe(true);
  });

  test('isBiometricEnabled возвращает false когда null', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    expect(await isBiometricEnabled()).toBe(false);
  });
});

describe('PIN code', () => {
  test('setPinCode сохраняет PIN в SecureStore', async () => {
    await setPinCode('1234');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pin_code', '1234');
  });

  test('verifyPinCode возвращает true при совпадении', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('1234');
    expect(await verifyPinCode('1234')).toBe(true);
  });

  test('verifyPinCode возвращает false при несовпадении', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('1234');
    expect(await verifyPinCode('9999')).toBe(false);
  });

  test('isPinSet возвращает true когда PIN установлен', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('1234');
    expect(await isPinSet()).toBe(true);
  });

  test('isPinSet возвращает false когда PIN не установлен', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    expect(await isPinSet()).toBe(false);
  });

  test('removePinCode удаляет из SecureStore', async () => {
    await removePinCode();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pin_code');
  });
});
