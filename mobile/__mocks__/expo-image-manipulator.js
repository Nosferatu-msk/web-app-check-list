module.exports = {
  manipulateAsync: jest.fn((uri, actions, options) =>
    Promise.resolve({
      uri: uri + '.compressed',
      width: 1280,
      height: 720,
    })
  ),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
};
