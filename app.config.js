// Load environment variables from .env file (for local development)
// In EAS builds, environment variables are injected automatically
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available in EAS build environment, which is fine
}

export default {
  expo: {
    name: "Radzi",
    slug: "ccapp-frontend",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "radzi",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    privacyPolicy: "https://www.radzi.com/privacy",
    ios: {
      bundleIdentifier: "com.radzi.app",
      buildNumber: "1",
      supportsTablet: true,
      usesAppleSignIn: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Radzi needs access to your photo library to let you select and upload images for your profile picture and posts.",
        NSLocationWhenInUseUsageDescription: "Radzi needs your location to track your cycling and walking activities while you use the app, and to show your position on the map.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Radzi needs continuous access to your location to automatically record complete trips even when the app is in the background or closed. This ensures no part of your journey is missed.",
        NSMotionUsageDescription: "Radzi uses motion data to detect your activity type (walking, running, cycling) for more accurate automatic tracking.",
        UIBackgroundModes: ["location"],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.radzi.app",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "com.google.android.gms.permission.ACTIVITY_RECOGNITION",
        "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
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
      "expo-font",
      "expo-localization",
      "expo-sqlite",
      [
        "expo-image-picker",
        {
          photosPermission: "Radzi needs access to your photo library to let you select images for your profile picture and posts."
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Radzi to use your location to automatically track your activities in the background.",
          locationAlwaysPermission: "Allow Radzi to track your activities all the time.",
          locationWhenInUsePermission: "Allow Radzi to use your location to track your activities and show your position on the map.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        }
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/icon.png",
          imageWidth: 120,
          resizeMode: "contain",
          backgroundColor: "#E6F4FE",
          dark: {
            backgroundColor: "#E6F4FE",
          },
        },
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsVersion: "11.16.0"
        },
      ],
      "expo-web-browser",
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.229488268800-st69okr9atquav65k8du0iov5fpgqsas",
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
      // These are available via Constants.expoConfig.extra
      mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
      openWeatherMapApiKey: process.env.EXPO_PUBLIC_OPENWEATHERMAP_API_KEY,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
    },
  },
};
