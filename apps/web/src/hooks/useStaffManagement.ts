import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMaintenanceGateway, useStaffGateway } from '../context/ApiContext';
import { useDataTable } from './useDataTable';
import type { CreateStaffDto, PropertyStaff } from '@tenants/shared-types';

export function useStaffManagement(selectedPropertyId: string | null) {
  const queryClient = useQueryClient();
  const staffGateway = useStaffGateway();
  const maintenanceGateway = useMaintenanceGateway();

  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<PropertyStaff | null>(null);
  const [assignModalStaff, setAssignModalStaff] = useState<PropertyStaff | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const {
    data: staffList = [],
    isLoading: isLoadingStaff,
    error: staffError,
  } = useQuery({
    queryKey: ['staff', selectedPropertyId, activeRoleFilter],
    queryFn: () => staffGateway.getStaff(selectedPropertyId || undefined, activeRoleFilter),
  });

  const { data: maintenanceCalls = [], isLoading: isLoadingCalls } = useQuery({
    queryKey: ['maintenance-calls', selectedPropertyId],
    queryFn: () =>
      maintenanceGateway.getMaintenanceCalls(
        selectedPropertyId ? { property_id: selectedPropertyId } : undefined
      ),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateStaffDto) => staffGateway.createStaff(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setIsStaffModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateStaffDto> }) =>
      staffGateway.updateStaff(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setIsStaffModalOpen(false);
      setEditingStaff(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffGateway.deleteStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  const assignCallMutation = useMutation({
    mutationFn: ({
      callId,
      staffId,
      scheduledDate,
      notes,
    }: {
      callId: string;
      staffId: string;
      scheduledDate?: string;
      notes?: string;
    }) =>
      maintenanceGateway.assignMaintenanceCallStaff(callId, {
        staff_id: staffId,
        scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        resolution_notes: notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-calls'] });
      setAssignModalStaff(null);
      setAssignError(null);
    },
    onError: (err: Error) => {
      setAssignError(err?.message || 'Failed to assign maintainer to call');
    },
  });

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (activeRoleFilter !== 'all' && s.role !== activeRoleFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const haystacks = [
          `${s.first_name} ${s.last_name}`,
          s.title,
          s.email,
          s.phone,
          s.specialization || '',
          s.property_name || '',
        ];
        return haystacks.some((val) => val.toLowerCase().includes(term));
      }
      return true;
    });
  }, [staffList, activeRoleFilter, statusFilter, searchTerm]);

  const {
    paginatedData: paginatedStaff,
    currentPage,
    pageSize,
    totalRecords,
    setCurrentPage,
    setPageSize,
  } = useDataTable({
    data: filteredStaff,
    initialPageSize: 8,
  });

  const kpis = useMemo(() => {
    const maintainers = staffList.filter((s) => s.role === 'maintainer');
    return {
      total: staffList.length,
      managers: staffList.filter((s) => s.role === 'manager').length,
      maintainersCount: maintainers.length,
      activeDispatchedCalls: maintainers.reduce((sum, m) => sum + (m.assigned_calls_count || 0), 0),
      security: staffList.filter((s) => s.role === 'security').length,
      cleaners: staffList.filter((s) => s.role === 'cleaner').length,
    };
  }, [staffList]);

  const eligibleCalls = useMemo(() => {
    if (!assignModalStaff) return [];
    return maintenanceCalls.filter((c) => {
      const matchesProperty =
        !assignModalStaff.property_id || c.property_id === assignModalStaff.property_id;
      const isOpen = c.status === 'reported' || c.status === 'dispatched' || c.status === 'in_progress';
      return matchesProperty && isOpen;
    });
  }, [maintenanceCalls, assignModalStaff]);

  const openAddModal = () => {
    setEditingStaff(null);
    setIsStaffModalOpen(true);
  };

  const openEditModal = (staff: PropertyStaff) => {
    setEditingStaff(staff);
    setIsStaffModalOpen(true);
  };

  const closeStaffModal = () => {
    setIsStaffModalOpen(false);
    setEditingStaff(null);
  };

  const openAssignModal = (staff: PropertyStaff) => {
    setAssignError(null);
    setAssignModalStaff(staff);
  };

  const closeAssignModal = () => {
    setAssignError(null);
    setAssignModalStaff(null);
  };

  return {
    staffList,
    isLoadingStaff,
    staffError,
    isLoadingCalls,
    filteredStaff,
    paginatedStaff,
    currentPage,
    pageSize,
    totalRecords,
    setCurrentPage,
    setPageSize,
    kpis,
    eligibleCalls,
    activeRoleFilter,
    setActiveRoleFilter,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    isStaffModalOpen,
    editingStaff,
    openAddModal,
    openEditModal,
    closeStaffModal,
    assignModalStaff,
    openAssignModal,
    closeAssignModal,
    assignError,
    createMutation,
    updateMutation,
    deleteMutation,
    assignCallMutation,
  };
}

