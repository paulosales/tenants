import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  CreateUserDto,
  ManagedUser,
  PropertyStaff,
  PropertyWithStats,
  Role,
  RoleDefinition,
  TenantWithUnit,
  UpdateUserDto,
} from '@tenants/shared-types';
import { AlertBanner } from '../common/AlertBanner';

interface UserFormModalProps {
  isOpen: boolean;
  editingUser: ManagedUser | null;
  roles: RoleDefinition[];
  properties: PropertyWithStats[];
  staffList: PropertyStaff[];
  tenantsList: TenantWithUnit[];
  isSubmitting: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onCreate: (dto: CreateUserDto) => void;
  onUpdate: (id: string, dto: UpdateUserDto) => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  editingUser,
  roles,
  properties,
  staffList,
  tenantsList,
  isSubmitting,
  errorMsg,
  onClose,
  onCreate,
  onUpdate,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('property_manager');
  const [phone, setPhone] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalError(null);
    setPassword('');
    if (editingUser) {
      setFullName(editingUser.full_name);
      setEmail(editingUser.email);
      setRole(editingUser.role);
      setPhone(editingUser.phone || '');
      setUnitNumber(editingUser.unit_number || '');
      setPropertyId(editingUser.property_id || '');
      setStaffId(editingUser.staff_id || '');
      setTenantId(editingUser.tenant_id || '');
      setIsActive(editingUser.is_active);
    } else {
      setFullName('');
      setEmail('');
      setRole('property_manager');
      setPhone('');
      setUnitNumber('');
      setPropertyId('');
      setStaffId('');
      setTenantId('');
      setIsActive(true);
    }
  }, [isOpen, editingUser]);

  if (!isOpen) return null;

  const isStaffLinkedRole =
    role === 'property_manager' || role === 'maintenance_staff' || role === 'staff';
  const isTenantRole = role === 'tenant';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (fullName.trim().length < 2) {
      setLocalError('Full name must be at least 2 characters.');
      return;
    }
    if (!email.trim().includes('@')) {
      setLocalError('Please provide a valid email address.');
      return;
    }
    if (!editingUser && password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }
    if (editingUser && password && password.length < 8) {
      setLocalError('Replacement password must be at least 8 characters long.');
      return;
    }

    if (editingUser) {
      onUpdate(editingUser.id, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        phone: phone.trim() || null,
        unit_number: unitNumber.trim() || null,
        property_id: propertyId || null,
        staff_id: isStaffLinkedRole && staffId ? staffId : null,
        tenant_id: isTenantRole && tenantId ? tenantId : null,
        is_active: isActive,
        ...(password ? { password } : {}),
      });
    } else {
      onCreate({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        phone: phone.trim() || undefined,
        unit_number: unitNumber.trim() || undefined,
        property_id: propertyId || null,
        staff_id: isStaffLinkedRole && staffId ? staffId : null,
        tenant_id: isTenantRole && tenantId ? tenantId : null,
        is_active: isActive,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 id="user-modal-title" className="text-lg font-bold text-slate-900">
              {editingUser ? `Edit User — ${editingUser.full_name}` : 'Create User Account'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign platform role permissions, property scope, and linked operational profile.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(localError || errorMsg) && (
            <AlertBanner
              variant="error"
              message={localError || errorMsg || ''}
              onDismiss={() => setLocalError(null)}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="user-full-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Full Name
              </label>
              <input
                id="user-full-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label htmlFor="user-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Login Email
              </label>
              <input
                id="user-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.rivera@property.local"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="user-role" className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Role
              </label>
              <select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                {roles.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label} ({r.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="user-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {editingUser ? 'Reset Password (Optional)' : 'Initial Password (Min 8 chars)'}
              </label>
              <input
                id="user-password"
                type="password"
                required={!editingUser}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingUser ? 'Leave blank to keep unchanged' : 'At least 8 characters'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="user-property"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Assigned Property
              </label>
              <select
                id="user-property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="">Portfolio-Wide / Unassigned</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="user-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Phone
              </label>
              <input
                id="user-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (206) 555-0100"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label htmlFor="user-unit" className="block text-xs font-semibold text-slate-700 mb-1">
                Unit / Office
              </label>
              <input
                id="user-unit"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. 201 or M-101"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          {isStaffLinkedRole && staffList.length > 0 && (
            <div>
              <label htmlFor="user-staff-link" className="block text-xs font-semibold text-slate-700 mb-1">
                Link to Staff Directory Record (Optional)
              </label>
              <select
                id="user-staff-link"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="">-- No linked staff profile --</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.role} — {s.title})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isTenantRole && tenantsList.length > 0 && (
            <div>
              <label htmlFor="user-tenant-link" className="block text-xs font-semibold text-slate-700 mb-1">
                Link to Resident / Tenant Record (Optional)
              </label>
              <select
                id="user-tenant-link"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="">-- No linked tenant profile --</option>
                {tenantsList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name} ({t.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              id="user-is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-indigo-600 h-4 w-4"
            />
            <span className="text-xs font-semibold text-slate-700">
              Account Active (uncheck to immediately suspend login access)
            </span>
          </label>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-user-submit-btn"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

