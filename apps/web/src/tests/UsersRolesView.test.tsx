import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../context/ApiContext';
import { createSegregatedGateways } from '../api/client';
import type { IApiGateways } from '../api/interfaces';
import { UsersRolesView } from '../components/UsersRolesView';
import { AdminAppContent } from '../App';
import type {
  ManagedUser,
  PropertyWithStats,
  RoleDefinition,
  UserSummary,
} from '@tenants/shared-types';

const mockProp: PropertyWithStats = {
  id: 'prop-users-1',
  name: 'Grandview Heights',
  address_line1: '1200 Grandview Ave',
  city: 'Seattle',
  state_province: 'WA',
  postal_code: '98101',
  unit_count: 10,
  occupied_units_count: 8,
  tenant_count: 8,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockRoles: RoleDefinition[] = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Full governance & RBAC control.',
    permissions: ['Manage users & assign roles'],
    user_count: 1,
  },
  {
    role: 'property_manager',
    label: 'Property Manager',
    description: 'Applications, staff, parking & approvals.',
    permissions: ['Approve applications'],
    user_count: 1,
  },
  {
    role: 'maintenance_staff',
    label: 'Maintainer',
    description: 'Work orders and status updates.',
    permissions: ['Update maintenance calls'],
    user_count: 1,
  },
  {
    role: 'staff',
    label: 'Building Staff',
    description: 'Cleaners and security messaging.',
    permissions: ['Message manager'],
    user_count: 1,
  },
  {
    role: 'tenant',
    label: 'Tenant / Resident',
    description: 'Resident amenities & requests.',
    permissions: ['Book amenities'],
    user_count: 1,
  },
];

const mockAdminUser: ManagedUser = {
  id: 'u-admin-1',
  email: 'admin@property.local',
  full_name: 'Chief Operations Admin',
  role: 'super_admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockStaffUser: ManagedUser = {
  id: 'u-staff-2',
  email: 'maria@property.local',
  full_name: 'Maria Gonzalez',
  role: 'staff',
  property_id: mockProp.id,
  property_name: mockProp.name,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function makeGateways(overrides: Partial<IApiGateways['users']> = {}): IApiGateways {
  const base = createSegregatedGateways();
  return {
    ...base,
    properties: {
      ...base.properties,
      getProperties: vi.fn().mockResolvedValue([mockProp]),
    },
    staff: {
      ...base.staff,
      getStaff: vi.fn().mockResolvedValue([]),
    },
    tenants: {
      ...base.tenants,
      getTenants: vi.fn().mockResolvedValue([]),
    },
    users: {
      getUsers: vi.fn().mockResolvedValue([mockAdminUser, mockStaffUser]),
      getRoles: vi.fn().mockResolvedValue(mockRoles),
      createUser: vi.fn().mockResolvedValue({
        ...mockStaffUser,
        id: 'u-created-3',
        email: 'new.tech@property.local',
        full_name: 'Sam Technician',
        role: 'maintenance_staff',
      }),
      updateUser: vi.fn().mockResolvedValue({
        ...mockStaffUser,
        role: 'maintenance_staff',
      }),
      deleteUser: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
  };
}

function renderWithGateways(ui: React.ReactElement, gateways: IApiGateways) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ApiProvider gateways={gateways}>{ui}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('UsersRolesView & Super Admin RBAC Administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders role cards matrix, user accounts table, and supports creating & re-assigning roles', async () => {
    const gateways = makeGateways();
    const currentUser: UserSummary = {
      id: mockAdminUser.id,
      email: mockAdminUser.email,
      full_name: mockAdminUser.full_name,
      role: 'super_admin',
    };

    renderWithGateways(
      <UsersRolesView
        properties={[mockProp]}
        selectedPropertyId={null}
        currentUser={currentUser}
      />,
      gateways
    );

    await waitFor(() => {
      expect(screen.getByText('Chief Operations Admin')).toBeInTheDocument();
      expect(screen.getByText('Maria Gonzalez')).toBeInTheDocument();
      expect(screen.getByText('System Roles & Permissions')).toBeInTheDocument();
    });

    // Inline role reassignment
    const roleSelect = screen.getByLabelText('Assign role for Maria Gonzalez') as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: 'maintenance_staff' } });

    await waitFor(() => {
      expect(gateways.users.updateUser).toHaveBeenCalledWith(mockStaffUser.id, {
        role: 'maintenance_staff',
      });
    });

    // Open Add User modal and submit new user
    fireEvent.click(document.getElementById('add-user-button')!);
    fireEvent.change(document.getElementById('user-full-name')!, {
      target: { value: 'Sam Technician' },
    });
    fireEvent.change(document.getElementById('user-email')!, {
      target: { value: 'new.tech@property.local' },
    });
    fireEvent.change(document.getElementById('user-role')!, {
      target: { value: 'maintenance_staff' },
    });
    fireEvent.change(document.getElementById('user-password')!, {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(document.getElementById('save-user-submit-btn')!);

    await waitFor(() => {
      expect(gateways.users.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new.tech@property.local',
          full_name: 'Sam Technician',
          role: 'maintenance_staff',
        })
      );
    });
  });

  it('prompts accessible delete confirmation modal before deleting a user account', async () => {
    const gateways = makeGateways();
    renderWithGateways(
      <UsersRolesView properties={[mockProp]} selectedPropertyId={null} currentUser={null} />,
      gateways
    );

    await waitFor(() => expect(screen.getByText('Maria Gonzalez')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Delete Maria Gonzalez'));
    expect(screen.getByText('Remove User Account')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm Delete'));
    await waitFor(() => {
      expect(gateways.users.deleteUser).toHaveBeenCalledWith(mockStaffUser.id);
    });
  });

  it('exposes Users & Roles nav tab strictly for Super Admin and hides it for Property Manager', async () => {
    const gateways = makeGateways();
    const superAdmin: UserSummary = {
      id: 'sa-1',
      email: 'admin@property.local',
      full_name: 'Admin',
      role: 'super_admin',
    };

    const { unmount } = renderWithGateways(
      <AdminAppContent user={superAdmin} onLogout={vi.fn()} />,
      gateways
    );
    await waitFor(() => expect(document.getElementById('nav-users')).toBeInTheDocument());
    unmount();

    const propManager: UserSummary = {
      id: 'pm-1',
      email: 'manager@property.local',
      full_name: 'Manager',
      role: 'property_manager',
    };
    renderWithGateways(<AdminAppContent user={propManager} onLogout={vi.fn()} />, gateways);
    await waitFor(() => expect(document.getElementById('nav-applications')).toBeInTheDocument());
    expect(document.getElementById('nav-users')).not.toBeInTheDocument();
  });
});

