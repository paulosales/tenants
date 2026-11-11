import React from 'react';
import { Plus, UserCog } from 'lucide-react';
import type { PropertyWithStats, UserSummary } from '@tenants/shared-types';
import { useUsersManagement } from '../hooks/useUsersManagement';
import { AlertBanner } from './common/AlertBanner';
import { ModalDialog } from './common/ModalDialog';
import { RoleMatrixSection } from './users/RoleMatrixSection';
import { UserFormModal } from './users/UserFormModal';
import { UsersTable } from './users/UsersTable';

interface UsersRolesViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  currentUser?: UserSummary | null;
}

export const UsersRolesView: React.FC<UsersRolesViewProps> = ({
  properties,
  selectedPropertyId,
  currentUser,
}) => {
  const vm = useUsersManagement(selectedPropertyId);

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
            vm.setEditingUser(null);
            vm.setErrorMsg(null);
            vm.setModalOpen(true);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add User Account</span>
        </button>
      </div>

      {vm.feedbackMsg && (
        <AlertBanner
          variant="success"
          message={vm.feedbackMsg}
          onDismiss={() => vm.setFeedbackMsg(null)}
        />
      )}

      {vm.errorMsg && !vm.modalOpen && (
        <AlertBanner
          variant="error"
          message={vm.errorMsg}
          onDismiss={() => vm.setErrorMsg(null)}
        />
      )}

      <RoleMatrixSection
        roles={vm.roles}
        activeRoleFilter={vm.roleFilter}
        onSelectRoleFilter={vm.setRoleFilter}
      />

      <UsersTable
        users={vm.usersList}
        roles={vm.roles}
        isLoading={vm.isLoading}
        isUpdating={vm.updateMutation.isPending}
        currentUser={currentUser}
        searchTerm={vm.searchTerm}
        roleFilter={vm.roleFilter}
        onSearchChange={vm.setSearchTerm}
        onRoleFilterChange={vm.setRoleFilter}
        onQuickRoleChange={(userId, role) =>
          vm.updateMutation.mutate({ id: userId, dto: { role } })
        }
        onToggleActive={(u) =>
          vm.updateMutation.mutate({ id: u.id, dto: { is_active: !u.is_active } })
        }
        onEditUser={(u) => {
          vm.setEditingUser(u);
          vm.setErrorMsg(null);
          vm.setModalOpen(true);
        }}
        onRequestDelete={vm.setDeletingUser}
      />

      <UserFormModal
        isOpen={vm.modalOpen}
        editingUser={vm.editingUser}
        roles={vm.roles}
        properties={properties}
        staffList={vm.staffList}
        tenantsList={vm.tenantsList}
        isSubmitting={vm.createMutation.isPending || vm.updateMutation.isPending}
        errorMsg={vm.errorMsg}
        onClose={() => {
          vm.setModalOpen(false);
          vm.setEditingUser(null);
        }}
        onCreate={(dto) => vm.createMutation.mutate(dto)}
        onUpdate={(id, dto) => vm.updateMutation.mutate({ id, dto })}
      />

      <ModalDialog
        isOpen={Boolean(vm.deletingUser)}
        title="Remove User Account"
        onClose={() => vm.setDeletingUser(null)}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to deactivate and remove login access for{' '}
            <strong>{vm.deletingUser?.full_name}</strong> ({vm.deletingUser?.email})? Active
            refresh tokens will be revoked immediately.
          </p>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => vm.setDeletingUser(null)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={vm.deleteMutation.isPending}
              onClick={() => vm.deletingUser && vm.deleteMutation.mutate(vm.deletingUser.id)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
            >
              {vm.deleteMutation.isPending ? 'Removing...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
};
