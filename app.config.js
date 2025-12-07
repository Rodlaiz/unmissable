// Load environment variables from .env file for local builds
require('dotenv').config();

module.exports = {
  expo: {
    name: "Unmissable",
    slug: "unmissable",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "unmissable",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#b52b1b"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.unmissable.app",
      usesAppleSignIn: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Unmissable needs your location to show events near you."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#b52b1b"
      },
      package: "com.unmissable.app",
      googleServicesFile: "./google-services.json",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION"
      ],
      navigationBar: {
        visible: "sticky",
        backgroundColor: "#ffffff"
      }
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      "expo-apple-authentication",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#b52b1b"
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Allow Unmissable to use your location to show nearby events."
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "158b0bb9-9911-4953-abe8-65ce015bbf0d"
      },
      // Expose environment variables through Constants.expoConfig.extra
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      ticketmasterApiKey: process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY,
      seatgeekClientId: process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID,
      expoProjectId: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
    },
    owner: "rodlaiz"
  }
};
