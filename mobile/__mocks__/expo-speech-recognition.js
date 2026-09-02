module.exports = {
  useSpeechRecognition: () => ({
    isSupported: true,
    isRecording: false,
    transcript: '',
    start: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(),
  }),
};
