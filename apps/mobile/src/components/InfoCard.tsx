import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { mobileTheme } from '../theme/mobileTheme';

interface InfoCardProps {
  title?: string;
  children: React.ReactNode;
}

export const InfoCard: React.FC<InfoCardProps> = ({ title, children }) => (
  <View style={styles.card}>
    {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileTheme.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    marginBottom: 16,
  },
  cardTitle: {
    color: mobileTheme.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    fontWeight: '600',
  },
});

