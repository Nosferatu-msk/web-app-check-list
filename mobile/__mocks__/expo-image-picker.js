module.exports = {
  launchCameraAsync: jest.fn(() => Promise.resolve({ cancelled: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ cancelled: true })),
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
  CameraType: { front: 'front', back: 'back' },
};
