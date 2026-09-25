/**
 * Jest mock for expo-av.
 *
 * Provides minimal stubs for Video component and ResizeMode enum so that
 * tests that render components importing expo-av do not require native modules.
 */
const React = require('react');
const { View } = require('react-native');

const ResizeMode = {
  CONTAIN: 'contain',
  COVER: 'cover',
  STRETCH: 'stretch',
};

class Video extends React.Component {
  render() {
    return React.createElement(View, {
      testID: this.props.testID,
      accessibilityLabel: 'video-player',
    });
  }
}

module.exports = {
  Video,
  ResizeMode,
};
