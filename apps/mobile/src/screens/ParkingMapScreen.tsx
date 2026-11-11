import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { InfoCard } from '../components/InfoCard';
import { ParkingGarageSvg } from '../components/ParkingGarageSvg';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusBanner } from '../components/StatusBanner';
import { useMobileParkingMap } from '../hooks/useMobileParkingMap';
import { mobileTheme } from '../theme/mobileTheme';

export const ParkingMapScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    spots,
    selectedSpotNumber,
    selectedSpot,
    isReserved,
    isReserving,
    selectSpot,
    confirmReservation,
  } = useMobileParkingMap();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Level P1 Garage Map" onBack={onBack} />

      <ParkingGarageSvg
        spots={spots}
        selectedSpotNumber={selectedSpotNumber}
        onSelectSpot={selectSpot}
      />

      <View style={styles.detailsSpacing}>
        <InfoCard>
          <Text style={styles.detailsHeader}>Spot Selected: {selectedSpotNumber}</Text>
          <Text style={styles.detailsRate}>
            {selectedSpot
              ? `${selectedSpot.hourlyRateLabel} • ${selectedSpot.monthlyRateLabel}`
              : '$5.00 / hour • $150.00 / month'}
          </Text>

          {isReserved ? (
            <StatusBanner title={`Spot ${selectedSpotNumber} Reserved Successfully!`} />
          ) : (
            <TouchableOpacity
              style={styles.reserveBtn}
              disabled={isReserving}
              onPress={confirmReservation}
            >
              <Text style={styles.reserveBtnText}>
                {isReserving ? 'Reserving...' : 'Confirm Spot Reservation'}
              </Text>
            </TouchableOpacity>
          )}
        </InfoCard>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mobileTheme.background,
    padding: 20,
    paddingTop: 50,
  },
  detailsSpacing: {
    marginTop: 20,
  },
  detailsHeader: {
    color: mobileTheme.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsRate: {
    color: mobileTheme.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  reserveBtn: {
    backgroundColor: mobileTheme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  reserveBtnText: {
    color: mobileTheme.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
