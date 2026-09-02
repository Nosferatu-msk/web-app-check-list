module.exports = {
  CameraView: 'CameraView',
  useCameraPermissions: () => [
    { granted: true },
    jest.fn(),
  ],
  CameraType: { back: 'back', front: 'front' },
  FlashMode: { on: 'on', off: 'off' },
};
