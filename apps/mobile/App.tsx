import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ParkingMapScreen } from './src/screens/ParkingMapScreen';
import { AmenityBookingScreen } from './src/screens/AmenityBookingScreen';

const queryClient = new QueryClient();

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'parking' | 'amenities'>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#090d16" />
        {currentScreen === 'dashboard' && (
          <DashboardScreen onNavigate={(screen) => setCurrentScreen(screen)} />
        )}
        {currentScreen === 'parking' && (
          <ParkingMapScreen onBack={() => setCurrentScreen('dashboard')} />
        )}
        {currentScreen === 'amenities' && (
          <AmenityBookingScreen onBack={() => setCurrentScreen('dashboard')} />
        )}
      </SafeAreaView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
});
