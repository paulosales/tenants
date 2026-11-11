import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusBanner } from '../components/StatusBanner';
import { useMobileAmenityBooking } from '../hooks/useMobileAmenityBooking';
import { mobileTheme } from '../theme/mobileTheme';

export const AmenityBookingScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    amenities,
    timeSlots,
    selectedAmenity,
    selectedTime,
    isBooked,
    isBooking,
    selectAmenity,
    selectTimeSlot,
    confirmBooking,
  } = useMobileAmenityBooking();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Book Property Amenity" onBack={onBack} />

      <Text style={styles.sectionHeader}>Select Amenity</Text>
      {amenities.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.amenityCard, selectedAmenity === item.name && styles.selectedCard]}
          onPress={() => selectAmenity(item.name)}
        >
          <View>
            <Text style={styles.amenityTitle}>{item.name}</Text>
            <Text style={styles.amenityCap}>Capacity: {item.cap} Guests</Text>
          </View>
          <Text style={styles.amenityRate}>{item.rate}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.sectionHeader, styles.slotsSectionHeader]}>
        Available Time Slots (Tomorrow • Local Time)
      </Text>
      <View style={styles.slotsGrid}>
        {timeSlots.map((slot) => (
          <TouchableOpacity
            key={slot}
            style={[styles.slotChip, selectedTime === slot && styles.selectedChip]}
            onPress={() => selectTimeSlot(slot)}
          >
            <Text style={[styles.slotText, selectedTime === slot && styles.selectedSlotText]}>
              {slot}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isBooked ? (
        <StatusBanner
          title="Reservation Confirmed!"
          subtitle={`${selectedAmenity} • ${selectedTime}`}
        />
      ) : (
        <TouchableOpacity
          style={styles.confirmBtn}
          disabled={isBooking}
          onPress={confirmBooking}
        >
          <Text style={styles.confirmBtnText}>
            {isBooking ? 'Scheduling...' : 'Schedule Slot'}
          </Text>
        </TouchableOpacity>
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
  sectionHeader: {
    color: mobileTheme.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  slotsSectionHeader: {
    marginTop: 20,
  },
  amenityCard: {
    backgroundColor: mobileTheme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedCard: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  amenityTitle: {
    color: mobileTheme.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  amenityCap: {
    color: mobileTheme.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  amenityRate: {
    color: mobileTheme.primaryLight,
    fontSize: 14,
    fontWeight: 'bold',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  slotChip: {
    backgroundColor: mobileTheme.surface,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  selectedChip: {
    borderColor: mobileTheme.success,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  slotText: {
    color: mobileTheme.textMuted,
    fontSize: 12,
  },
  selectedSlotText: {
    color: mobileTheme.successLight,
    fontWeight: 'bold',
  },
  confirmBtn: {
    backgroundColor: mobileTheme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: mobileTheme.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
