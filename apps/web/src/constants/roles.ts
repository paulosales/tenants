import type { Role, RoleDefinition } from '@tenants/shared-types';

export interface RoleCatalogEntry {
  role: Role;
  label: string;
  demoEmail: string;
  capabilitiesSummary: string;
  description: string;
  permissions: string[];
  badgeClass: string;
}

/**
 * Single Open/Closed source of truth for UI role metadata, badges, and directory hints.
 */
export const ROLE_CATALOG: readonly RoleCatalogEntry[] = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    demoEmail: 'admin@property.local',
    capabilitiesSummary: 'Full portfolio access, users & roles, staff, audit & resident portal oversight',
    description: 'Unrestricted governance, RBAC user/role provisioning, audit logs, and full property access.',
    permissions: ['Manage users & assign roles', 'Full portfolio CRUD', 'Security audit logs'],
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    role: 'property_manager',
    label: 'Property Manager',
    demoEmail: 'manager@property.local',
    capabilitiesSummary: 'Applications, staff, parking assignment, amenity approvals & messaging',
    description: 'Tenancy applications, staff management, parking assignments, amenity approvals & messaging.',
    permissions: ['Approve applications', 'Manage staff & parking', 'Approve amenities'],
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    role: 'maintenance_staff',
    label: 'Maintainer',
    demoEmail: 'maintainer@property.local',
    capabilitiesSummary: 'Receive maintenance dispatches, update status & resolve calls',
    description: 'Receive maintenance dispatches, update job progress, and resolve tickets on Web & Mobile.',
    permissions: ['View call queue', 'Update & solve work orders', 'Message managers'],
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    role: 'staff',
    label: 'Building Staff',
    demoEmail: 'staff@property.local',
    capabilitiesSummary: 'Team directory & direct messaging with Property Management',
    description: 'Cleaners, security & concierge messaging directly with management.',
    permissions: ['Direct & team messaging', 'Mobile sync', 'Staff directory access'],
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    role: 'tenant',
    label: 'Tenant / Resident',
    demoEmail: 'tenant@property.local',
    capabilitiesSummary: 'Resident View only: schedule amenities & submit maintenance calls',
    description: 'Scoped strictly to Resident Portal for amenities and maintenance calls.',
    permissions: ['Book amenities', 'Manage own reservations', 'File maintenance calls'],
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
  },
];

export const ROLE_BY_KEY: Record<Role, RoleCatalogEntry> = ROLE_CATALOG.reduce(
  (acc, item) => {
    acc[item.role] = item;
    return acc;
  },
  {} as Record<Role, RoleCatalogEntry>
);

export const FALLBACK_ROLE_DEFINITIONS: RoleDefinition[] = ROLE_CATALOG.map((item) => ({
  role: item.role,
  label: item.label,
  description: item.description,
  permissions: item.permissions,
  user_count: 0,
}));

