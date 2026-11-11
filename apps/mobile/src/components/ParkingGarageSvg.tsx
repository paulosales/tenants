import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import type { MobileParkingSpot } from '../domain/services';
import {
  MOBILE_PARKING_STATUS_COLORS,
  MOBILE_SELECTED_SPOT_STYLE,
  mobileTheme,
} from '../theme/mobileTheme';

interface ParkingGarageSvgProps {
  spots: MobileParkingSpot[];
  selectedSpotNumber: string;
  onSelectSpot: (spotNumber: string) => void;
}

export const ParkingGarageSvg: React.FC<ParkingGarageSvgProps> = ({
  spots,
  selectedSpotNumber,
  onSelectSpot,
}) => {
  const resolveSpotStyle = (spot: MobileParkingSpot) =>
    selectedSpotNumber === spot.num
      ? MOBILE_SELECTED_SPOT_STYLE
      : MOBILE_PARKING_STATUS_COLORS[spot.status];

  return (
    <View style={styles.mapContainer}>
      <Svg width="100%" height={370} viewBox="0 0 365 370">
        {/* Central Lane */}
        <Rect x="0" y="165" width="365" height="40" fill="rgba(30, 41, 59, 0.5)" />

        {spots.map((spot) => {
          const col = resolveSpotStyle(spot);
          const isSelected = selectedSpotNumber === spot.num;
          return (
            <G key={spot.id} onPress={() => onSelectSpot(spot.num)}>
              <Rect
                x={spot.x}
                y={spot.y}
                width={spot.w}
                height={spot.h}
                rx={6}
                fill={col.fill}
                stroke={col.stroke}
                strokeWidth={isSelected ? 2.5 : 1}
              />
              <SvgText
                x={spot.x + spot.w / 2}
                y={spot.y + spot.h / 2 - 6}
                fill={mobileTheme.textPrimary}
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
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    backgroundColor: mobileTheme.canvasSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    overflow: 'hidden',
    padding: 8,
  },
});

