/**
 * Custom Expo config plugin — removes entitlements that require an active
 * Apple Developer account but are not yet provisioned.
 *
 * Strips:
 *   - com.apple.developer.applesignin — injected by expo-apple-authentication.
 *     Cannot be satisfied in a simulator build without a paid Apple Developer
 *     Program signing certificate. The Apple Sign-In UI is conditionally hidden
 *     via AppleAuthentication.isAvailableAsync() — it will re-appear in
 *     production/TestFlight builds once the Apple Developer account is active.
 *   - aps-environment — injected by expo prebuild when a scheme is present.
 *     The Apple Developer account is now active (setup.md 11.4 complete) but
 *     setup.md 11.5 (creating the App ID with Push Notifications capability)
 *     has not been run yet, so the entitlement cannot be satisfied. Remove this
 *     entry once setup.md 11.5 is complete and the capability is provisioned.
 *
 * To restore for App Store builds (after setup.md 11.5):
 * 1. Remove the `aps-environment` delete line below.
 * 2. Re-add `"usesAppleSignIn": true` to app.json ios section.
 * 3. Remove the `com.apple.developer.applesignin` delete line and this file if
 *    no other stripping is needed.
 * 4. Run expo prebuild --clean and pod install.
 */

const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * @param {import('@expo/config-types').ExpoConfig} config
 * @returns {import('@expo/config-types').ExpoConfig}
 */
function withRemoveUnprovisionedEntitlements(config) {
  return withEntitlementsPlist(config, (c) => {
    // Remove the key injected by expo-apple-authentication's auto-plugin
    delete c.modResults['com.apple.developer.applesignin'];
    // Remove the APS environment entitlement injected by prebuild when scheme
    // is set — push capability not yet provisioned (see setup.md 11.5)
    delete c.modResults['aps-environment'];
    return c;
  });
}

module.exports = withRemoveUnprovisionedEntitlements;
