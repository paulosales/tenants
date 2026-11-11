import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Edit2,
  Plus,
  Search,
  Trash2,
  UserCog,
  UserCheck,
  UserX,
} from 'lucide-react';
import type {
  CreateUserDto,
  ManagedUser,
  PropertyWithStats,
  Role,
  RoleDefinition,
  UpdateUserDto,
  UserSummary,
} from '@tenants/shared-types';
import {
  useStaffGateway,
  useTenantsGateway,
  useUsersAdminGateway,
} from '../context/ApiContext';
import { AlertBanner } from './common/AlertBanner';
import { ROLE_BADGE_STYLES, RoleMatrixSection } from './users/RoleMatrixSection';
import { UserFormModal } from './users/UserFormModal';

interface UsersRolesViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  currentUser?: UserSummary | null;
}

const FALLBACK_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Full governance, RBAC administration, and portfolio access.',
    permissions: ['Manage users & assign roles', 'Full portfolio CRUD', 'Security audit logs'],
    user_count: 0,
  },
  {
    role: 'property_manager',
    label: 'Property Manager',
    description: 'Tenancy applications, staff management, parking, amenities & messaging.',
    permissions: ['Approve applications', 'Manage staff & parking', 'Approve amenities'],
    user_count: 0,
  },
  {
    role: 'maintenance_staff',
    label: 'Maintainer',
    description: 'Receive maintenance dispatches, update job progress, and resolve tickets.',
    permissions: ['View call queue', 'Update & solve work orders', 'Message managers'],
    user_count: 0,
  },
  {
    role: 'staff',
    label: 'Building Staff',
    description: 'Cleaners, security & concierge messaging directly with management.',
    permissions: ['Direct & team messaging', 'Mobile sync', 'Staff directory access'],
    user_count: 0,
  },
  {
    role: 'tenant',
    label: 'Tenant / Resident',
    description: 'Scoped strictly to Resident Portal for amenities and maintenance calls.',
    permissions: ['Book amenities', 'Manage own reservations', 'File maintenance calls'],
    user_count: 0,
  },
];

export const UsersRolesView: React.FC<UsersRolesViewProps> = ({
  properties,
  selectedPropertyId,
  currentUser,
}) => {
  const queryClient = useQueryClient();
  const usersGateway = useUsersAdminGateway();
  const staffGateway = useStaffGateway();
  const tenantsGateway = useTenantsGateway();

  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: rolesData = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => usersGateway.getRoles(),
  });

  const { data: usersList = [], isLoading } = useQuery({
    queryKey: ['admin-users', roleFilter, selectedPropertyId, searchTerm],
    queryFn: () =>
      usersGateway.getUsers({
        role: roleFilter === 'all' ? undefined : roleFilter,
        property_id: selectedPropertyId || undefined,
        q: searchTerm || undefined,
      }),
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-for-user-linking'],
    queryFn: () => staffGateway.getStaff(),
  });

  const { data: tenantsList = [] } = useQuery({
    queryKey: ['tenants-for-user-linking'],
    queryFn: () => tenantsGateway.getTenants(),
  });

  const roles = useMemo(
    () => (rolesData.length > 0 ? rolesData : FALLBACK_ROLE_DEFINITIONS),
    [rolesData]
  );

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersGateway.createUser(dto),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setFeedbackMsg(`Created account for ${created.full_name} (${created.role}).`);
      setErrorMsg(null);
      setModalOpen(false);
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create user account.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      usersGateway.updateUser(id, dto),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setFeedbackMsg(
        `Updated ${updated.full_name} — Role: ${updated.role}, Status: ${updated.is_active ? 'Active' : 'Suspended'}.`
      );
      setErrorMsg(null);
      setModalOpen(false);
      setEditingUser(null);
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update user account.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersGateway.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      if (deletingUser) {
        setFeedbackMsg(`Removed user account for ${deletingUser.full_name}.`);
      }
      setDeletingUser(null);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove user account.');
      setDeletingUser(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <UserCog className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Users & Roles Management</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create accounts, assign RBAC roles, link properties/staff/tenants, and control active access.
            </p>
          </div>
        </div>

        <button
          id="add-user-button"
          type="button"
          onClick={() => {
            setEditingUser(null);
            setErrorMsg(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add User Account</span>
        </button>
      </div>

      {feedbackMsg && (
        <AlertBanner
          variant="success"
          message={feedbackMsg}
          onDismiss={() => setFeedbackMsg(null)}
        />
      )}

      {errorMsg && !modalOpen && (
        <AlertBanner variant="error" message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}

      {/* Role Cards Matrix */}
      <RoleMatrixSection
        roles={roles}
        activeRoleFilter={roleFilter}
        onSelectRoleFilter={setRoleFilter}
      />

      {/* Users Filters + Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="search-users-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              aria-label="Filter users by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading user accounts...</div>
        ) : usersList.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No user accounts matched your current search or filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-5">User Identity</th>
                  <th className="py-3 px-5">Role Assignment</th>
                  <th className="py-3 px-5">Property & Scope</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {usersList.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{u.full_name}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                        {u.phone && <div className="text-[11px] text-slate-400">{u.phone}</div>}
                      </td>

                      <td className="py-3.5 px-5">
                        <select
                          aria-label={`Assign role for ${u.full_name}`}
                          disabled={isSelf || updateMutation.isPending}
                          value={u.role}
                          onChange={(e) =>
                            updateMutation.mutate({
                              id: u.id,
                              dto: { role: e.target.value as Role },
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-70 ${
                            ROLE_BADGE_STYLES[u.role] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {roles.map((r) => (
                            <option key={r.role} value={r.role}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-5 text-xs text-slate-600">
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{u.property_name || 'All Portfolio'}</span>
                        </div>
                        {u.unit_number && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Unit {u.unit_number}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-5">
                        <button
                          type="button"
                          disabled={isSelf || updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              id: u.id,
                              dto: { is_active: !u.is_active },
                            })
                          }
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer disabled:opacity-60 ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                          title={isSelf ? 'Cannot deactivate your own account' : 'Toggle account status'}
                        >
                          {u.is_active ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Suspended</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            type="button"
                            aria-label={`Edit ${u.full_name}`}
                            onClick={() => {
                              setEditingUser(u);
                              setErrorMsg(null);
                              setModalOpen(true);
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              aria-label={`Delete ${u.full_name}`}
                              onClick={() => setDeletingUser(u)}
                              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <UserFormModal
        isOpen={modalOpen}
        editingUser={editingUser}
        roles={roles}
        properties={properties}
        staffList={staffList}
        tenantsList={tenantsList}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        errorMsg={errorMsg}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        onCreate={(dto) => createMutation.mutate(dto)}
        onUpdate={(id, dto) => updateMutation.mutate({ id, dto })}
      />

      {/* Delete Confirmation Modal (replaces native confirm()) */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Remove User Account</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to deactivate and remove login access for{' '}
              <strong>{deletingUser.full_name}</strong> ({deletingUser.email})? Active refresh
              tokens will be revoked immediately.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingUser.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                {deleteMutation.isPending ? 'Removing...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

