import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

export default function EventsLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontSize: layout.fontSize.lg,
          fontWeight: layout.fontWeight.bold,
        },
        headerTintColor: colors.primary,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Events',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Event Details',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
