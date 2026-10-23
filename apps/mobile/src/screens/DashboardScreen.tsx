import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface DashboardProps {
  onNavigate: (screen: 'parking' | 'amenities') => void;
}

export const DashboardScreen: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.tenantName}>Alex Resident</Text>
        <Text style={styles.unitBadge}>Unit PH-402 • Verified Resident</Text>
      </View>

      {/* Quick Action Tiles */}
      <View style={styles.tilesGrid}>
        <TouchableOpacity style={styles.tile} onPress={() => onNavigate('parking')}>
          <Text style={styles.tileIcon}>🚗</Text>
          <Text style={styles.tileTitle}>Reserve Parking</Text>
          <Text style={styles.tileSubtitle}>Level P1 Interactive Map</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tile} onPress={() => onNavigate('amenities')}>
          <Text style={styles.tileIcon}>🎾</Text>
          <Text style={styles.tileTitle}>Book Amenity</Text>
          <Text style={styles.tileSubtitle}>Tennis, Lounge & BBQ</Text>
        </TouchableOpacity>
      </View>

      {/* Active Pass Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Reserved Spot</Text>
        <View style={styles.spotRow}>
          <View style={styles.spotBadge}>
            <Text style={styles.spotNumber}>P1-01</Text>
          </View>
          <View>
            <Text style={styles.spotDetails}>Subterranean Level P1</Text>
            <Text style={styles.spotType}>EV Fast Charging Bay</Text>
          </View>
        </View>
      </View>

      {/* Upcoming Amenity Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming Reservation</Text>
        <View style={styles.bookingRow}>
          <Text style={styles.amenityName}>Skyline Rooftop Lounge</Text>
          <Text style={styles.bookingTime}>Tomorrow • 18:00 - 20:00</Text>
          <Text style={styles.bookingStatus}>Confirmed & Paid</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  content: {
    padding: 20,
    paddingTop: 50,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    color: '#94a3b8',
    fontSize: 14,
  },
  tenantName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  unitBadge: {
    color: '#818cf8',
    fontSize: 12,
    marginTop: 4,
  },
  tilesGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  tile: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tileIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  tileTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tileSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    fontWeight: '600',
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
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  spotDetails: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  spotType: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 2,
  },
  bookingRow: {
    gap: 4,
  },
  amenityName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  bookingTime: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  bookingStatus: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
