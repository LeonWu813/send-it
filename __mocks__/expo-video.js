/**
 * Jest mock for expo-video.
 *
 * Provides minimal stubs for VideoView component and useVideoPlayer hook so
 * that tests rendering components that import expo-video do not require native
 * modules.
 */
const React = require('react');
const { View } = require('react-native');

function VideoView(props) {
  // Expose onFirstFrameRender so tests can call it to simulate the video being
  // ready for display (Bug 3 fix — clears the isVideoLoading overlay).
  return React.createElement(View, {
    testID: props.testID,
    accessibilityLabel: 'video-player',
    onFirstFrameRender: props.onFirstFrameRender,
  });
}

function useVideoPlayer(_source, setup) {
  const player = {
    loop: false,
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    replaceAsync: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn((_event, _callback) => ({ remove: jest.fn() })),
  };
  if (typeof setup === 'function') {
    setup(player);
  }
  return player;
}

function createVideoPlayer(_source) {
  return {
    loop: false,
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    replaceAsync: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn((_event, _callback) => ({ remove: jest.fn() })),
  };
}

module.exports = {
  VideoView,
  useVideoPlayer,
  createVideoPlayer,
};
