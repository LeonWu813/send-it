/**
 * Custom Expo config plugin — removes the Apple Sign-In entitlement that
 * expo-apple-authentication injects automatically via withVersionedExpoSDKPlugins.
 *
 * Context: The Apple Developer account is deferred, so the entitlement
 * (com.apple.developer.applesignin) cannot be satisfied by a simulator build
 * without a paid Apple Developer Program signing certificate.
 *
 * This plugin runs after all SDK plugins and strips the key from the
 * .entitlements plist so that local simulator builds work without the
 * entitlement. The Apple Sign-In UI is conditionally hidden via
 * AppleAuthentication.isAvailableAsync() — it will re-appear automatically
 * in production/TestFlight builds once the Apple Developer account is active
 * and usesAppleSignIn is re-enabled.
 *
 * To restore Apple Sign-In for App Store builds:
 * 1. Re-add `"usesAppleSignIn": true` to app.json ios section.
 * 2. Remove this plugin and delete this file.
 * 3. Run expo prebuild --clean and pod install.
 */

const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * @param {import('@expo/config-types').ExpoConfig} config
 * @returns {import('@expo/config-types').ExpoConfig}
 */
function withRemoveAppleSignInEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    // Remove the key injected by expo-apple-authentication's auto-plugin
    delete c.modResults['com.apple.developer.applesignin'];
    return c;
  });
}

module.exports = withRemoveAppleSignInEntitlement;
