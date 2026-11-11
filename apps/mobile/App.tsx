import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UserSummary } from '@tenants/shared-types';
import { MobileAuthProvider, useMobileAuth } from './src/context/MobileAuthContext';
import { MobileServicesProvider } from './src/context/MobileServicesContext';
import { AmenityBookingScreen } from './src/screens/AmenityBookingScreen';
import { DashboardScreen, type MobileDestinationScreen } from './src/screens/DashboardScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MaintenanceCallsScreen } from './src/screens/MaintenanceCallsScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { ParkingMapScreen } from './src/screens/ParkingMapScreen';
import { mobileTheme } from './src/theme/mobileTheme';

type MobileScreenKey = 'dashboard' | MobileDestinationScreen;

const queryClient = new QueryClient();

interface ScreenContext {
  user: UserSummary;
  onLogout: () => void;
  navigate: (screen: MobileScreenKey) => void;
}

const SCREEN_REGISTRY: Record<MobileScreenKey, (ctx: ScreenContext) => React.ReactElement> = {
  dashboard: (ctx) => (
    <DashboardScreen
      user={ctx.user}
      onLogout={ctx.onLogout}
      onNavigate={(dest) => ctx.navigate(dest)}
    />
  ),
  parking: (ctx) => <ParkingMapScreen onBack={() => ctx.navigate('dashboard')} />,
  amenities: (ctx) => <AmenityBookingScreen onBack={() => ctx.navigate('dashboard')} />,
  maintenance: (ctx) => (
    <MaintenanceCallsScreen user={ctx.user} onBack={() => ctx.navigate('dashboard')} />
  ),
  messages: (ctx) => (
    <MessagesScreen user={ctx.user} onBack={() => ctx.navigate('dashboard')} />
  ),
};

const MobileAppContent: React.FC = () => {
  const { user, isRestoring, login, logout } = useMobileAuth();
  const [currentScreen, setCurrentScreen] = useState<MobileScreenKey>('dashboard');

  useEffect(() => {
    setCurrentScreen('dashboard');
  }, [user?.id]);

  if (isRestoring) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={mobileTheme.primaryLight} size="large" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return SCREEN_REGISTRY[currentScreen]({
    user,
    onLogout: logout,
    navigate: setCurrentScreen,
  });
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MobileServicesProvider>
        <MobileAuthProvider>
          <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={mobileTheme.background} />
            <MobileAppContent />
          </SafeAreaView>
        </MobileAuthProvider>
      </MobileServicesProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mobileTheme.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: mobileTheme.background,
  },
});
