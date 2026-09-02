module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        module: 'commonjs',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@react-navigation|react-native-paper|react-native-vector-icons|@testing-library|expo-sqlite|expo-camera|expo-speech-recognition)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native-paper$': '<rootDir>/__mocks__/react-native-paper.js',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/expo-vector-icons.js',
    '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-sharing$': '<rootDir>/__mocks__/expo-sharing.js',
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.js',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js',
    '^expo-camera$': '<rootDir>/__mocks__/expo-camera.js',
    '^expo-speech-recognition$': '<rootDir>/__mocks__/expo-speech-recognition.js',
    '^expo-local-authentication$': '<rootDir>/__mocks__/expo-local-authentication.js',
    '^expo-image-manipulator$': '<rootDir>/__mocks__/expo-image-manipulator.js',
    '^expo-image-manipulator/legacy$': '<rootDir>/__mocks__/expo-image-manipulator.js',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.js',
    '^@tanstack/react-query$': '<rootDir>/__mocks__/react-query.js',
    '^test-renderer$': 'react-test-renderer',
  },
  globals: {
    __DEV__: true,
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js|jsx)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
