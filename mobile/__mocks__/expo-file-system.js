module.exports = {
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  deleteAsync: jest.fn(() => Promise.resolve()),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  getFreeDiskStorageAsync: jest.fn(() => Promise.resolve(1000 * 1024 * 1024)),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
};
