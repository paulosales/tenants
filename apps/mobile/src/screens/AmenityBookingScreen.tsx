import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export const AmenityBookingScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [selectedAmenity, setSelectedAmenity] = useState('Skyline Rooftop Lounge');
  const [selectedTime, setSelectedTime] = useState('16:00 - 18:00');
  const [isBooked, setIsBooked] = useState(false);

  const amenities = [
    { id: '1', name: 'Skyline Rooftop Lounge', rate: '$50/hr', cap: 40 },
    { id: '2', name: 'Championship Tennis Court', rate: '$25/hr', cap: 4 },
    { id: '3', name: 'Poolside BBQ Pavilion', rate: '$35/hr', cap: 25 },
  ];

  const timeSlots = ['10:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00', '18:00 - 20:00'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Book Property Amenity</Text>
      </View>

      <Text style={styles.sectionHeader}>Select Amenity</Text>
      {amenities.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.amenityCard, selectedAmenity === item.name && styles.selectedCard]}
          onPress={() => { setSelectedAmenity(item.name); setIsBooked(false); }}
        >
          <View>
            <Text style={styles.amenityTitle}>{item.name}</Text>
            <Text style={styles.amenityCap}>Capacity: {item.cap} Guests</Text>
          </View>
          <Text style={styles.amenityRate}>{item.rate}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Available Time Slots (Tomorrow)</Text>
      <View style={styles.slotsGrid}>
        {timeSlots.map((slot) => (
          <TouchableOpacity
            key={slot}
            style={[styles.slotChip, selectedTime === slot && styles.selectedChip]}
            onPress={() => { setSelectedTime(slot); setIsBooked(false); }}
          >
            <Text style={[styles.slotText, selectedTime === slot && styles.selectedSlotText]}>
              {slot}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isBooked ? (
        <View style={styles.successBanner}>
          <Text style={styles.successTitle}>Reservation Confirmed!</Text>
          <Text style={styles.successSubtitle}>{selectedAmenity} • {selectedTime}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.confirmBtn} onPress={() => setIsBooked(true)}>
          <Text style={styles.confirmBtnText}>Schedule Slot</Text>
        </TouchableOpacity>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  amenityCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  amenityCap: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  amenityRate: {
    color: '#818cf8',
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
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  selectedChip: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  slotText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  selectedSlotText: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  confirmBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  successTitle: {
    color: '#34d399',
    fontSize: 15,
    fontWeight: 'bold',
  },
  successSubtitle: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 4,
  },
});
