import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Role, UserSummary } from '@tenants/shared-types';
import { InfoCard } from '../components/InfoCard';
import { useResidentDashboard } from '../hooks/useResidentDashboard';
import { mobileTheme } from '../theme/mobileTheme';

export type MobileDestinationScreen = 'parking' | 'amenities' | 'maintenance' | 'messages';

interface DashboardProps {
  user: UserSummary;
  onLogout: () => void;
  onNavigate: (screen: MobileDestinationScreen) => void;
}

const ALL_TILES: Array<{
  screen: MobileDestinationScreen;
  roles: Role[];
  icon: string;
  title: string;
  subtitle: string;
}> = [
  {
    screen: 'maintenance',
    roles: ['super_admin', 'property_manager', 'maintenance_staff'],
    icon: '🔧',
    title: 'Maintenance Calls',
    subtitle: 'Update & solve work orders',
  },
  {
    screen: 'messages',
    roles: ['super_admin', 'property_manager', 'maintenance_staff', 'staff'],
    icon: '💬',
    title: 'Manager Chat',
    subtitle: 'Talk to Property Management',
  },
  {
    screen: 'parking',
    roles: ['super_admin', 'property_manager', 'tenant'],
    icon: '🚗',
    title: 'Reserve Parking',
    subtitle: 'Level P1 Interactive Map',
  },
  {
    screen: 'amenities',
    roles: ['super_admin', 'property_manager', 'tenant'],
    icon: '🎾',
    title: 'Book Amenity',
    subtitle: 'Tennis, Lounge & BBQ',
  },
];

export const DashboardScreen: React.FC<DashboardProps> = ({ user, onLogout, onNavigate }) => {
  const { data: summary } = useResidentDashboard();
  const visibleTiles = useMemo(
    () => ALL_TILES.filter((t) => t.roles.includes(user.role)),
    [user.role]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.tenantName}>{user.full_name}</Text>
          <Text style={styles.unitBadge}>
            {user.role.replace('_', ' ').toUpperCase()}
            {user.unit_number ? ` • Unit ${user.unit_number}` : ''}
          </Text>
        </View>

        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tilesGrid}>
        {visibleTiles.map((tile) => (
          <TouchableOpacity
            key={tile.screen}
            style={styles.tile}
            onPress={() => onNavigate(tile.screen)}
          >
            <Text style={styles.tileIcon}>{tile.icon}</Text>
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={styles.tileSubtitle}>{tile.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {user.role === 'tenant' && summary && (
        <>
          <InfoCard title="Current Reserved Spot">
            <View style={styles.spotRow}>
              <View style={styles.spotBadge}>
                <Text style={styles.spotNumber}>{summary.currentSpot.spotNumber}</Text>
              </View>
              <View>
                <Text style={styles.spotDetails}>{summary.currentSpot.level}</Text>
                <Text style={styles.spotType}>{summary.currentSpot.bayType}</Text>
              </View>
            </View>
          </InfoCard>

          <InfoCard title="Upcoming Reservation">
            <View style={styles.bookingRow}>
              <Text style={styles.amenityName}>{summary.upcomingReservation.amenityName}</Text>
              <Text style={styles.bookingTime}>{summary.upcomingReservation.timeLabel}</Text>
              <Text style={styles.bookingStatus}>{summary.upcomingReservation.statusLabel}</Text>
            </View>
          </InfoCard>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mobileTheme.background,
  },
  content: {
    padding: 20,
    paddingTop: 50,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  header: {
    flex: 1,
  },
  logoutBtn: {
    backgroundColor: mobileTheme.surface,
    borderColor: mobileTheme.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: mobileTheme.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  greeting: {
    color: mobileTheme.textMuted,
    fontSize: 14,
  },
  tenantName: {
    color: mobileTheme.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  unitBadge: {
    color: mobileTheme.primaryLight,
    fontSize: 12,
    marginTop: 4,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  tile: {
    minWidth: '47%',
    flex: 1,
    backgroundColor: mobileTheme.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: mobileTheme.border,
  },
  tileIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  tileTitle: {
    color: mobileTheme.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  tileSubtitle: {
    color: mobileTheme.textSubtle,
    fontSize: 11,
    marginTop: 2,
  },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  spotBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  spotNumber: {
    color: mobileTheme.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  spotDetails: {
    color: mobileTheme.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  spotType: {
    color: mobileTheme.success,
    fontSize: 12,
    marginTop: 2,
  },
  bookingRow: {
    gap: 4,
  },
  amenityName: {
    color: mobileTheme.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  bookingTime: {
    color: mobileTheme.textSecondary,
    fontSize: 13,
  },
  bookingStatus: {
    color: mobileTheme.success,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
