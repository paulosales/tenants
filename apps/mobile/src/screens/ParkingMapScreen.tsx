import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';

export const ParkingMapScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [selectedSpot, setSelectedSpot] = useState<string | null>('P1-01');
  const [isReserved, setIsReserved] = useState(false);

  const spots = [
    { id: '1', num: 'P1-01', x: 20, y: 30, w: 70, h: 120, status: 'vacant', type: 'EV' },
    { id: '2', num: 'P1-02', x: 105, y: 30, w: 70, h: 120, status: 'vacant', type: 'EV' },
    { id: '3', num: 'P1-03', x: 190, y: 30, w: 70, h: 120, status: 'occupied', type: 'STD' },
    { id: '4', num: 'P1-04', x: 275, y: 30, w: 70, h: 120, status: 'reserved', type: 'STD' },
    { id: '5', num: 'P1-05', x: 20, y: 220, w: 70, h: 120, status: 'vacant', type: 'ACC' },
    { id: '6', num: 'P1-06', x: 105, y: 220, w: 70, h: 120, status: 'vacant', type: 'STD' },
  ];

  const getColor = (spotNum: string, status: string) => {
    if (selectedSpot === spotNum) return { fill: 'rgba(99, 102, 241, 0.4)', stroke: '#818cf8' };
    if (status === 'vacant') return { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981' };
    if (status === 'reserved') return { fill: 'rgba(245, 158, 11, 0.25)', stroke: '#f59e0b' };
    return { fill: 'rgba(244, 63, 94, 0.25)', stroke: '#f43f5e' };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Level P1 Garage Map</Text>
      </View>

      {/* SVG Canvas */}
      <View style={styles.mapContainer}>
        <Svg width="100%" height={370} viewBox="0 0 365 370">
          {/* Central Lane */}
          <Rect x="0" y="165" width="365" height="40" fill="rgba(30, 41, 59, 0.5)" />

          {/* Spots */}
          {spots.map((spot) => {
            const col = getColor(spot.num, spot.status);
            return (
              <G key={spot.id} onPress={() => { setSelectedSpot(spot.num); setIsReserved(false); }}>
                <Rect
                  x={spot.x}
                  y={spot.y}
                  width={spot.w}
                  height={spot.h}
                  rx={6}
                  fill={col.fill}
                  stroke={col.stroke}
                  strokeWidth={selectedSpot === spot.num ? 2.5 : 1}
                />
                <SvgText
                  x={spot.x + spot.w / 2}
                  y={spot.y + spot.h / 2 - 6}
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {spot.num}
                </SvgText>
                <SvgText
                  x={spot.x + spot.w / 2}
                  y={spot.y + spot.h / 2 + 12}
                  fill={col.stroke}
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {spot.type}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Spot Details Card */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsHeader}>Spot Selected: {selectedSpot}</Text>
        <Text style={styles.detailsRate}>$5.00 / hour • $150.00 / month</Text>

        {isReserved ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>Spot {selectedSpot} Reserved Successfully!</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.reserveBtn}
            onPress={() => setIsReserved(true)}
          >
            <Text style={styles.reserveBtnText}>Confirm Spot Reservation</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    padding: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  mapContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    padding: 8,
  },
  detailsCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 20,
  },
  detailsHeader: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsRate: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  reserveBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  reserveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  successText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '600',
  },
});
