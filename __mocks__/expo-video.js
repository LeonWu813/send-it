/**
 * Jest mock for expo-video.
 *
 * Provides minimal stubs for VideoView component and useVideoPlayer hook so
 * that tests rendering components that import expo-video do not require native
 * modules.
 *
 * Note: the loading overlay is now cleared via useEventListener(player,
 * 'statusChange', ...) rather than onFirstFrameRender. Tests that need to
 * simulate the overlay clearing should call the statusChange listener registered
 * via player.addListener, or use the statusChangeListeners helper exposed by the
 * mock player. The VideoView mock no longer needs to carry onFirstFrameRender.
 */
const React = require('react');
const { View } = require('react-native');

function VideoView(props) {
  return React.createElement(View, {
    testID: props.testID,
    accessibilityLabel: 'video-player',
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
