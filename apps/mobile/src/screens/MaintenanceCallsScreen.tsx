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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MaintenanceCall, MaintenanceStatus, UserSummary } from '@tenants/shared-types';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusBanner } from '../components/StatusBanner';
import { useMobileMaintenanceService } from '../context/MobileServicesContext';
import { mobileTheme } from '../theme/mobileTheme';

interface MaintenanceCallsScreenProps {
  user: UserSummary;
  onBack: () => void;
}

const STATUS_ACTIONS: Array<{ status: MaintenanceStatus; label: string }> = [
  { status: 'dispatched', label: 'Dispatch' },
  { status: 'in_progress', label: 'Start Work' },
  { status: 'resolved', label: 'Mark Solved' },
];

export const MaintenanceCallsScreen: React.FC<MaintenanceCallsScreenProps> = ({ user, onBack }) => {
  const queryClient = useQueryClient();
  const maintenanceService = useMobileMaintenanceService();
  const [selectedCall, setSelectedCall] = useState<MaintenanceCall | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['mobile-maintenance-calls', user.property_id],
    queryFn: () => maintenanceService.getCalls(user.property_id || undefined),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      callId,
      status,
      notes,
    }: {
      callId: string;
      status: MaintenanceStatus;
      notes?: string;
    }) => maintenanceService.updateCallStatus(callId, status, notes),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['mobile-maintenance-calls'] });
      setStatusFeedback(`Ticket ${updated.ticket_number} -> ${updated.status.toUpperCase()}`);
      setSelectedCall(updated);
      setResolutionNotes('');
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update maintenance call status');
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Maintenance Calls" onBack={onBack} />

      {statusFeedback ? (
        <View style={styles.bannerWrap}>
          <StatusBanner title={statusFeedback} />
        </View>
      ) : null}

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={mobileTheme.primaryLight} style={styles.loader} />
      ) : calls.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Maintenance Calls Found</Text>
          <Text style={styles.emptySub}>New unit work orders will appear here in real time.</Text>
        </View>
      ) : (
        calls.map((call) => {
          const isSelected = selectedCall?.id === call.id;
          return (
            <View key={call.id} style={[styles.card, isSelected && styles.cardSelected]}>
              <TouchableOpacity onPress={() => setSelectedCall(isSelected ? null : call)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.ticketNumber}>{call.ticket_number}</Text>
                  <Text style={styles.statusPill}>{call.status.replace('_', ' ').toUpperCase()}</Text>
                </View>
                <Text style={styles.callTitle}>{call.title}</Text>
                <Text style={styles.callMeta}>
                  Unit {call.unit_number} • Priority: {call.priority.toUpperCase()}
                </Text>
                <Text style={styles.callDesc}>{call.description}</Text>
                {call.resolution_notes ? (
                  <Text style={styles.notesPreview}>Notes: {call.resolution_notes}</Text>
                ) : null}
              </TouchableOpacity>

              {isSelected && call.status !== 'resolved' && call.status !== 'cancelled' && (
                <View style={styles.actionsSection}>
                  <Text style={styles.notesLabel}>Resolution / Field Notes (Optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={resolutionNotes}
                    onChangeText={setResolutionNotes}
                    placeholder="Parts replaced or diagnostic summary..."
                    placeholderTextColor={mobileTheme.textSubtle}
                  />
                  <View style={styles.actionsRow}>
                    {STATUS_ACTIONS.filter((a) => a.status !== call.status).map((act) => (
                      <TouchableOpacity
                        key={act.status}
                        disabled={updateMutation.isPending}
                        onPress={() =>
                          updateMutation.mutate({
                            callId: call.id,
                            status: act.status,
                            notes:
                              act.status === 'resolved'
                                ? resolutionNotes || 'Solved by field maintainer'
                                : resolutionNotes || undefined,
                          })
                        }
                        style={[
                          styles.actionBtn,
                          act.status === 'resolved' && styles.actionBtnSolve,
                        ]}
                      >
                        <Text style={styles.actionBtnText}>{act.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: mobileTheme.background },
  content: { padding: 20, paddingTop: 24 },
  bannerWrap: { marginBottom: 14 },
  loader: { marginTop: 32 },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#f43f5e',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: '#fda4af', fontSize: 12, fontWeight: '600' },
  emptyCard: {
    backgroundColor: mobileTheme.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    alignItems: 'center',
  },
  emptyTitle: { color: mobileTheme.textPrimary, fontSize: 15, fontWeight: 'bold' },
  emptySub: { color: mobileTheme.textMuted, fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: mobileTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: mobileTheme.border,
    padding: 16,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: mobileTheme.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumber: { color: mobileTheme.primaryLight, fontSize: 12, fontWeight: 'bold' },
  statusPill: {
    color: mobileTheme.successLight,
    fontSize: 11,
    fontWeight: 'bold',
  },
  callTitle: { color: mobileTheme.textPrimary, fontSize: 15, fontWeight: 'bold' },
  callMeta: { color: mobileTheme.textMuted, fontSize: 12, marginTop: 4 },
  callDesc: { color: mobileTheme.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 18 },
  notesPreview: { color: mobileTheme.successLight, fontSize: 11, marginTop: 8 },
  actionsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: mobileTheme.border,
  },
  notesLabel: { color: mobileTheme.textMuted, fontSize: 11, marginBottom: 6 },
  notesInput: {
    backgroundColor: mobileTheme.background,
    borderColor: mobileTheme.border,
    borderWidth: 1,
    borderRadius: 10,
    color: mobileTheme.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    backgroundColor: mobileTheme.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  actionBtnSolve: {
    backgroundColor: mobileTheme.success,
  },
  actionBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
});

