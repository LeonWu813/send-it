/**
 * Manual mock for react-native-safe-area-context.
 *
 * Used by Jest for all tests. Provides a no-op SafeAreaProvider and a
 * useSafeAreaInsets() that returns zero insets, so screens using safe area
 * hooks work correctly in the test environment without native module setup.
 */
const React = require('react');

const MOCK_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const MOCK_FRAME = { x: 0, y: 0, width: 375, height: 812 };

module.exports = {
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => MOCK_INSETS,
  useSafeAreaFrame: () => MOCK_FRAME,
  SafeAreaInsetsContext: React.createContext(MOCK_INSETS),
  SafeAreaFrameContext: React.createContext(MOCK_FRAME),
  initialWindowMetrics: {
    frame: MOCK_FRAME,
    insets: MOCK_INSETS,
  },
};
