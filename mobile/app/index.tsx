import { Redirect } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/store';
import { colors } from '@/constants/colors';

export default function Index(): React.ReactElement {
  const { isAuthenticated, isLoading, hasCompletedOnboarding } = useAuth();

  if (isLoading) {
    return <View style={styles.container} />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  // Show onboarding for first-time users
  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/auth/landing" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
