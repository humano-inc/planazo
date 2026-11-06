import { Alert, Linking } from 'react-native';

/** Hand a URL to the system, and say so if nothing can take it. */
export function openLink(url: string): void {
  Linking.openURL(url).catch(() =>
    Alert.alert("Couldn't open that", 'Check your connection and try again.'),
  );
}
