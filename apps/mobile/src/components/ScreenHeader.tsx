import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { mobileTheme } from '../theme/mobileTheme';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, onBack }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={styles.backButton}>
      <Text style={styles.backText}>← Back</Text>
    </TouchableOpacity>
    <Text style={styles.title}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    color: mobileTheme.primaryLight,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: mobileTheme.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

