import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.raysconnect.app",
  appName: "Rays Connect",
  webDir: "dist",
  bundledWebRuntime: false,
  android: { allowMixedContent: false }
};

export default config;
