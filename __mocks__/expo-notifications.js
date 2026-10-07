/**
 * Jest mock for expo-notifications.
 *
 * Provides minimal stubs for the permissions and push-token APIs used by
 * useSession (AC-054 device token registration). Tests that need to simulate
 * specific permission states or token values can override these mocks with
 * mockResolvedValueOnce() per test.
 */
const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted', granted: true });
const getExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-token]' });

module.exports = {
  __esModule: true,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  // Permission status constants
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
};
