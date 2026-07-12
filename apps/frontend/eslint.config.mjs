import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: ["*.config.mjs", "*.config.js"],
  },
];

export default config;
