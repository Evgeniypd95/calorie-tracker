/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch-widget",
  name: "Text to Calorie AI Complications",
  // No `icon` here: watch-widget extensions inherit their icon from the
  // parent watch app and can't use a regular AppIcon.appiconset — passing
  // `icon` generates iPhone-shaped icon sizes that actool rejects when
  // compiling for watchOS ("did not have any applicable content").
  // Must be nested under the *watch app's* bundle id (its actual parent
  // target), not the main iOS app's — otherwise install fails with
  // MIInstallerErrorDomain code 37 ("App Extensions must be prefixed
  // with the main bundle identifier").
  bundleIdentifier: `${config.ios.bundleIdentifier}.watch.watch-widget`,
  entitlements: {
    "com.apple.security.application-groups": ["group.com.evgenypavlovd.texttocalai"],
  },
  colors: {
    primary: { light: "#059669", dark: "#34D399" },
  },
});
