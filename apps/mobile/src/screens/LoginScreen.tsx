import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { mobileTheme } from '../theme/mobileTheme';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
}

const ROLE_QUICK_EMAILS: Array<{ label: string; email: string; roleNote: string }> = [
  { label: 'Maintainer', email: 'maintainer@property.local', roleNote: 'Update & solve maintenance calls' },
  { label: 'Staff', email: 'staff@property.local', roleNote: 'Chat directly with Property Manager' },
  { label: 'Manager', email: 'manager@property.local', roleNote: 'Field dispatch & team messaging' },
  { label: 'Tenant', email: 'tenant@property.local', roleNote: 'Resident parking & amenities' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.brandBlock}>
        <Text style={styles.brandTag}>APEXLIVING MOBILE</Text>
        <Text style={styles.title}>Field & Resident Sign In</Text>
        <Text style={styles.subtitle}>
          Authenticate with your role account to chat with managers, update work orders, or manage resident bookings.
        </Text>
      </View>

      <View style={styles.card}>
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@property.local"
          placeholderTextColor={mobileTheme.textSubtle}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={mobileTheme.textSubtle}
          secureTextEntry
          maxLength={128}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.directoryCard}>
        <Text style={styles.directoryTitle}>Role Account Hints (Tap to Fill Email)</Text>
        {ROLE_QUICK_EMAILS.map((item) => (
          <TouchableOpacity
            key={item.email}
            style={styles.directoryItem}
            onPress={() => {
              setEmail(item.email);
              setErrorMsg(null);
            }}
          >
            <View style={styles.directoryRow}>
              <Text style={styles.directoryLabel}>{item.label}</Text>
              <Text style={styles.directoryEmail}>{item.email}</Text>
            </View>
            <Text style={styles.directoryNote}>{item.roleNote}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
    paddingTop: 48,
  },
  brandBlock: {
    marginBottom: 24,
  },
  brandTag: {
    color: mobileTheme.primaryLight,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  title: {
    color: mobileTheme.textPrimary,
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 6,
  },
  subtitle: {
    color: mobileTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  card: {
    backgroundColor: mobileTheme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    padding: 18,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#f43f5e',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#fda4af',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    color: mobileTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: mobileTheme.background,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    borderRadius: 12,
    color: mobileTheme.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 14,
  },
  button: {
    backgroundColor: mobileTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  directoryCard: {
    backgroundColor: mobileTheme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    padding: 16,
    gap: 10,
  },
  directoryTitle: {
    color: mobileTheme.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  directoryItem: {
    backgroundColor: mobileTheme.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: mobileTheme.border,
  },
  directoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  directoryLabel: {
    color: mobileTheme.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  directoryEmail: {
    color: mobileTheme.primaryLight,
    fontSize: 11,
  },
  directoryNote: {
    color: mobileTheme.textSubtle,
    fontSize: 11,
    marginTop: 3,
  },
});

