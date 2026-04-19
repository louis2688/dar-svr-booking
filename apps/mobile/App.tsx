import { StatusBar } from "expo-status-bar";
import { Platform, SafeAreaView, Text, View } from "react-native";
import { WebView } from "react-native-webview";

export default function App() {
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: webUrl }}
          startInLoadingState
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
        />
      </View>
      <StatusBar style={Platform.OS === "ios" ? "dark" : "auto"} />
    </SafeAreaView>
  );
}
