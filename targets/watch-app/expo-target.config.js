/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch",
  name: "Text to Calorie AI",
  icon: "../../assets/icon.png",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.evgenypavlovd.texttocalai"],
  },
  colors: {
    primary: { light: "#059669", dark: "#34D399" },
    protein: { light: "#EF4444", dark: "#EF4444" },
    carbs: { light: "#3B82F6", dark: "#3B82F6" },
    fat: { light: "#F59E0B", dark: "#F59E0B" },
  },
});
