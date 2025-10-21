export default {
  expo: {
    name: "BeActive",
    slug: "ccapp-frontend",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "beactive",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.beactive.app",
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "BeActive needs your location to track your activities and show your position on the map.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "BeActive needs your location to track your activities in the background.",
      },
    },
    android: {
      package: "com.beactive.app",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
      ],
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsVersion: "11.14.0",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "377c486d-066c-4fa6-a11f-98195f1b848e",
      },
      mapboxPublicToken: process.env.MAPBOX_ACCESS_TOKEN,
    },
  },
};
