import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquare, Radio, Send, ShieldCheck, User } from 'lucide-react';
import type { PropertyWithStats, UserSummary } from '@tenants/shared-types';
import { useMessagesGateway, useStaffGateway } from '../context/ApiContext';
import { AlertBanner } from './common/AlertBanner';

interface StaffMessagesViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  currentUser?: UserSummary | null;
}

export const StaffMessagesView: React.FC<StaffMessagesViewProps> = ({
  properties,
  selectedPropertyId,
  currentUser,
}) => {
  const queryClient = useQueryClient();
  const messagesGateway = useMessagesGateway();
  const staffGateway = useStaffGateway();

  const effectivePropertyId =
    selectedPropertyId || currentUser?.property_id || properties[0]?.id || '';

  const isManagerOrAdmin =
    !currentUser ||
    currentUser.role === 'super_admin' ||
    currentUser.role === 'property_manager';

  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [messageDraft, setMessageDraft] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: staffRoster = [] } = useQuery({
    queryKey: ['staff-for-messaging', effectivePropertyId],
    queryFn: () => staffGateway.getStaff(effectivePropertyId || undefined),
    enabled: Boolean(effectivePropertyId),
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['staff-messages', effectivePropertyId, isManagerOrAdmin ? selectedStaffId : 'self'],
    queryFn: () =>
      messagesGateway.getMessages(
        effectivePropertyId,
        isManagerOrAdmin && selectedStaffId ? selectedStaffId : undefined
      ),
    enabled: Boolean(effectivePropertyId),
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      messagesGateway.sendMessage({
        property_id: effectivePropertyId,
        recipient_staff_id: isManagerOrAdmin && selectedStaffId ? selectedStaffId : null,
        body: messageDraft.trim(),
      }),
    onSuccess: () => {
      setMessageDraft('');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['staff-messages'] });
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send message');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => messagesGateway.markMessageRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-messages'] });
    },
  });

  const selectedStaffMember = useMemo(
    () => staffRoster.find((s) => s.id === selectedStaffId),
    [staffRoster, selectedStaffId]
  );

  const propertyName =
    properties.find((p) => p.id === effectivePropertyId)?.name || 'Assigned Property';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Team & Management Messaging
          </h2>
          <p className="text-sm text-slate-500">
            {isManagerOrAdmin
              ? `Direct messaging and team broadcasts with cleaners, maintainers, and security at ${propertyName}.`
              : `Direct communication channel with your Property Manager at ${propertyName}.`}
          </p>
        </div>
      </div>

      {errorMsg && (
        <AlertBanner variant="error" message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}

      {!effectivePropertyId ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Select a property from the sidebar to open staff messaging.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Directory Panel */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-4 space-y-2 h-fit">
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              {isManagerOrAdmin ? 'Staff Recipients' : 'Channels'}
            </div>

            <button
              type="button"
              onClick={() => setSelectedStaffId('')}
              className={`w-full flex items-center space-x-3 p-3 rounded-2xl text-left transition-all cursor-pointer ${
                selectedStaffId === ''
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Radio className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold">
                  {isManagerOrAdmin ? 'All Property Staff (Broadcast / Feed)' : 'Management & Team Feed'}
                </div>
                <div
                  className={`text-[11px] truncate ${
                    selectedStaffId === '' ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {propertyName}
                </div>
              </div>
            </button>

            {isManagerOrAdmin &&
              staffRoster
                .filter((s) => s.role !== 'manager')
                .map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedStaffId(member.id)}
                    className={`w-full flex items-center space-x-3 p-3 rounded-2xl text-left transition-all cursor-pointer ${
                      selectedStaffId === member.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">
                        {member.first_name} {member.last_name}
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          selectedStaffId === member.id ? 'text-indigo-100' : 'text-slate-500'
                        }`}
                      >
                        {member.role.toUpperCase()} · {member.title}
                      </div>
                    </div>
                  </button>
                ))}
          </div>

          {/* Right Conversation Thread */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 flex flex-col min-h-[480px] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2.5">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedStaffMember
                      ? `Direct Thread: ${selectedStaffMember.first_name} ${selectedStaffMember.last_name} (${selectedStaffMember.role})`
                      : `${propertyName} Operations Channel`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Real-time property coordination with field staff and mobile sync
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                <span>Synced with Mobile</span>
              </span>
            </div>

            <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[420px]">
              {isLoading ? (
                <div className="text-center text-xs text-slate-400 py-10">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-12">
                  No messages yet. Start a conversation below!
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = currentUser && msg.sender_user_id === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center space-x-2 mb-1 text-[11px] text-slate-500">
                        <span className="font-bold text-slate-700">{msg.sender_name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] uppercase">
                          {msg.sender_role.replace('_', ' ')}
                        </span>
                        <span>{new Date(msg.created_at).toLocaleString()}</span>
                      </div>

                      <div
                        className={`max-w-lg rounded-2xl px-4 py-3 text-sm ${
                          isOwn
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-900 border border-slate-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        {!isOwn && !msg.is_read && (
                          <button
                            type="button"
                            onClick={() => markReadMutation.mutate(msg.id)}
                            className="mt-2 inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Mark as read</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!messageDraft.trim()) return;
                sendMutation.mutate();
              }}
              className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center space-x-3"
            >
              <input
                id="staff-message-input"
                type="text"
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder={
                  selectedStaffMember
                    ? `Message ${selectedStaffMember.first_name}...`
                    : 'Write a message to property management / operations team...'
                }
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                id="send-staff-message-btn"
                disabled={sendMutation.isPending || !messageDraft.trim()}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{sendMutation.isPending ? 'Sending...' : 'Send'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

