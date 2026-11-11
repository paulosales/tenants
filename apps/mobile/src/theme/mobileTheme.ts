import { tokens } from '@tenants/shared-ui';

export type MobileSpotStatus = 'vacant' | 'occupied' | 'reserved';

/**
 * OCP-compliant status-to-style lookup driven directly by shared design tokens.
 */
export const MOBILE_PARKING_STATUS_COLORS: Record<
  MobileSpotStatus,
  { fill: string; stroke: string }
> = {
  vacant: {
    fill: tokens.parkingColors.vacant.fill,
    stroke: tokens.parkingColors.vacant.stroke,
  },
  reserved: {
    fill: tokens.parkingColors.reserved.fill,
    stroke: tokens.parkingColors.reserved.stroke,
  },
  occupied: {
    fill: tokens.parkingColors.occupied.fill,
    stroke: tokens.parkingColors.occupied.stroke,
  },
};

export const MOBILE_SELECTED_SPOT_STYLE = {
  fill: tokens.parkingColors.selected.fill,
  stroke: tokens.parkingColors.selected.stroke,
};

export const mobileTheme = {
  background: '#090d16',
  surface: '#111827',
  canvasSurface: tokens.colors.slate[900],
  border: tokens.colors.slate[800],
  textPrimary: '#ffffff',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  primary: tokens.colors.primary[600],
  primaryLight: '#818cf8',
  success: tokens.colors.emerald[500],
  successLight: tokens.colors.emerald[400],
} as const;

