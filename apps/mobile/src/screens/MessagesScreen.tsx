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
import type { UserSummary } from '@tenants/shared-types';
import { ScreenHeader } from '../components/ScreenHeader';
import { useMobileMessagingService } from '../context/MobileServicesContext';
import { mobileTheme } from '../theme/mobileTheme';

interface MessagesScreenProps {
  user: UserSummary;
  onBack: () => void;
}

const DEFAULT_PROPERTY_ID = '11111111-2222-3333-4444-555555555551';

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ user, onBack }) => {
  const queryClient = useQueryClient();
  const messagingService = useMobileMessagingService();
  const [draft, setDraft] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const propertyId = user.property_id || DEFAULT_PROPERTY_ID;

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['mobile-staff-messages', propertyId],
    queryFn: () => messagingService.getMessages(propertyId),
    refetchInterval: 8000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => messagingService.sendMessage(propertyId, body),
    onSuccess: () => {
      setDraft('');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['mobile-staff-messages', propertyId] });
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send message');
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerPad}>
        <ScreenHeader title="Manager & Team Chat" onBack={onBack} />
      </View>

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {isLoading ? (
          <ActivityIndicator color={mobileTheme.primaryLight} />
        ) : messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet. Send a message to your property manager.</Text>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_user_id === user.id;
            return (
              <View
                key={msg.id}
                style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
              >
                <Text style={styles.senderMeta}>
                  {msg.sender_name} ({msg.sender_role.replace('_', ' ')})
                </Text>
                <Text style={styles.bodyText}>{msg.body}</Text>
                <Text style={styles.timeText}>
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message property manager..."
          placeholderTextColor={mobileTheme.textSubtle}
        />
        <TouchableOpacity
          style={styles.sendBtn}
          disabled={sendMutation.isPending || !draft.trim()}
          onPress={() => sendMutation.mutate(draft.trim())}
        >
          <Text style={styles.sendBtnText}>{sendMutation.isPending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: mobileTheme.background },
  headerPad: { paddingHorizontal: 20, paddingTop: 24 },
  errorBox: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#f43f5e',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  errorText: { color: '#fda4af', fontSize: 12 },
  list: { flex: 1 },
  listContent: { padding: 20, gap: 10 },
  emptyText: { color: mobileTheme.textMuted, fontSize: 13, textAlign: 'center', marginTop: 20 },
  bubble: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    maxWidth: '88%',
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: mobileTheme.primary,
    borderColor: mobileTheme.primary,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: mobileTheme.surface,
    borderColor: mobileTheme.border,
  },
  senderMeta: { color: '#e2e8f0', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  bodyText: { color: '#ffffff', fontSize: 13, lineHeight: 18 },
  timeText: { color: '#cbd5e1', fontSize: 10, marginTop: 4, textAlign: 'right' },
  composer: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: mobileTheme.border,
    backgroundColor: mobileTheme.surface,
    gap: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: mobileTheme.background,
    borderColor: mobileTheme.border,
    borderWidth: 1,
    borderRadius: 12,
    color: mobileTheme.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: mobileTheme.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});

