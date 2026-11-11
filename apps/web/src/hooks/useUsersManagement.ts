import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateUserDto,
  ManagedUser,
  Role,
  UpdateUserDto,
} from '@tenants/shared-types';
import { FALLBACK_ROLE_DEFINITIONS } from '../constants/roles';
import {
  useStaffGateway,
  useTenantsGateway,
  useUsersAdminGateway,
} from '../context/ApiContext';

/**
 * Coordinates Users & Roles queries, filtering, and CRUD/role-update mutations (SRP).
 */
export function useUsersManagement(selectedPropertyId: string | null) {
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

  const invalidateUserQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
  };

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersGateway.createUser(dto),
    onSuccess: (created) => {
      invalidateUserQueries();
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
      invalidateUserQueries();
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
      invalidateUserQueries();
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

  return {
    roleFilter,
    setRoleFilter,
    searchTerm,
    setSearchTerm,
    modalOpen,
    setModalOpen,
    editingUser,
    setEditingUser,
    deletingUser,
    setDeletingUser,
    feedbackMsg,
    setFeedbackMsg,
    errorMsg,
    setErrorMsg,
    roles,
    usersList,
    isLoading,
    staffList,
    tenantsList,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}

