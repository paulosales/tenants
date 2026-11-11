import React, { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import type { PropertyStaff, PropertyWithStats } from '@tenants/shared-types';
import { useStaffManagement } from '../hooks/useStaffManagement';
import { ConfirmModal } from './common/ConfirmModal';
import { AssignCallModal } from './staff/AssignCallModal';
import { StaffFormModal } from './staff/StaffFormModal';
import { StaffKpiCards } from './staff/StaffKpiCards';
import { StaffRosterFilters } from './staff/StaffRosterFilters';
import { StaffRosterTable } from './staff/StaffRosterTable';

interface StaffViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  onSelectProperty?: (id: string | null) => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
}) => {
  const vm = useStaffManagement(selectedPropertyId);
  const [confirmDeleteStaff, setConfirmDeleteStaff] = useState<PropertyStaff | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Properties Staff & Operations Team</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage property managers, technical maintainers, security personnel, and cleaners. Assign maintainers
              directly to tenant maintenance calls.
            </p>
          </div>
        </div>

        <button
          id="add-staff-button"
          onClick={vm.openAddModal}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      <StaffKpiCards kpis={vm.kpis} />

      <StaffRosterFilters
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onSelectProperty={onSelectProperty}
        activeRoleFilter={vm.activeRoleFilter}
        onChangeRoleFilter={vm.setActiveRoleFilter}
        searchTerm={vm.searchTerm}
        onChangeSearchTerm={vm.setSearchTerm}
        statusFilter={vm.statusFilter}
        onChangeStatusFilter={vm.setStatusFilter}
        counts={{
          total: vm.staffList.length,
          managers: vm.kpis.managers,
          maintainers: vm.kpis.maintainersCount,
          security: vm.kpis.security,
          cleaners: vm.kpis.cleaners,
        }}
      />

      <StaffRosterTable
        staff={vm.paginatedStaff}
        isLoading={vm.isLoadingStaff}
        error={vm.staffError}
        currentPage={vm.currentPage}
        pageSize={vm.pageSize}
        totalRecords={vm.totalRecords}
        onPageChange={vm.setCurrentPage}
        onPageSizeChange={vm.setPageSize}
        onEditStaff={vm.openEditModal}
        onDeleteStaff={(member) => setConfirmDeleteStaff(member)}
        onAssignCall={vm.openAssignModal}
      />

      <ConfirmModal
        isOpen={Boolean(confirmDeleteStaff)}
        title="Remove Staff Member"
        message={
          confirmDeleteStaff
            ? `Are you sure you want to remove ${confirmDeleteStaff.first_name} ${confirmDeleteStaff.last_name}?`
            : ''
        }
        confirmLabel="Remove Member"
        isLoading={vm.deleteMutation.isPending}
        onCancel={() => setConfirmDeleteStaff(null)}
        onConfirm={() => {
          if (confirmDeleteStaff) {
            vm.deleteMutation.mutate(confirmDeleteStaff.id);
            setConfirmDeleteStaff(null);
          }
        }}
      />

      <StaffFormModal
        isOpen={vm.isStaffModalOpen}
        editingStaff={vm.editingStaff}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        isSubmitting={vm.createMutation.isPending || vm.updateMutation.isPending}
        onClose={vm.closeStaffModal}
        onSubmitForm={(data) => {
          if (vm.editingStaff) {
            vm.updateMutation.mutate({ id: vm.editingStaff.id, dto: data });
          } else {
            vm.createMutation.mutate(data);
          }
        }}
      />

      <AssignCallModal
        staff={vm.assignModalStaff}
        eligibleCalls={vm.eligibleCalls}
        isLoadingCalls={vm.isLoadingCalls}
        isSubmitting={vm.assignCallMutation.isPending}
        error={vm.assignError}
        onClose={vm.closeAssignModal}
        onConfirmAssign={(params) => vm.assignCallMutation.mutate(params)}
      />
    </div>
  );
};
