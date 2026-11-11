import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileServicesProvider } from './src/context/MobileServicesContext';
import { AmenityBookingScreen } from './src/screens/AmenityBookingScreen';
import { DashboardScreen, type MobileDestinationScreen } from './src/screens/DashboardScreen';
import { ParkingMapScreen } from './src/screens/ParkingMapScreen';
import { mobileTheme } from './src/theme/mobileTheme';

type MobileScreenKey = 'dashboard' | MobileDestinationScreen;

const queryClient = new QueryClient();

const SCREEN_REGISTRY: Record<
  MobileScreenKey,
  (navigate: (screen: MobileScreenKey) => void) => React.ReactElement
> = {
  dashboard: (navigate) => <DashboardScreen onNavigate={(dest) => navigate(dest)} />,
  parking: (navigate) => <ParkingMapScreen onBack={() => navigate('dashboard')} />,
  amenities: (navigate) => <AmenityBookingScreen onBack={() => navigate('dashboard')} />,
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<MobileScreenKey>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <MobileServicesProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor={mobileTheme.background} />
          {SCREEN_REGISTRY[currentScreen](setCurrentScreen)}
        </SafeAreaView>
      </MobileServicesProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mobileTheme.background,
  },
});
