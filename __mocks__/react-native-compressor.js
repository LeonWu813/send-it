// Mock for react-native-compressor (AC-031).
// react-native-compressor is a native module; unit tests mock it entirely.
// Video.compress resolves with the original URI by default (no-op compression).
// Tests can override mockVideoCompress to simulate progress callbacks or errors.

const mockVideoCompress = jest.fn().mockImplementation((uri, _options, onProgress) => {
  // Simulate a single progress callback at 100% then resolve with the URI.
  if (onProgress) {
    onProgress(1.0);
  }
  return Promise.resolve(uri);
});

const Video = {
  compress: mockVideoCompress,
};

module.exports = {
  __esModule: true,
  Video,
  mockVideoCompress,
};
