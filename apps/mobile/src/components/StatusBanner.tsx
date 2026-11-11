import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { mobileTheme } from '../theme/mobileTheme';

interface StatusBannerProps {
  title: string;
  subtitle?: string;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ title, subtitle }) => (
  <View style={styles.banner}>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: mobileTheme.success,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  title: {
    color: mobileTheme.successLight,
    fontSize: 14,
    fontWeight: 'bold',
  },
  subtitle: {
    color: mobileTheme.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
});

