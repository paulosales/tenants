import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { CreateTenancyApplicationDto, PublicPropertyListing } from '@tenants/shared-types';
import { AlertBanner } from '../common/AlertBanner';
import { ModalDialog } from '../common/ModalDialog';
import { formatMonthlyRent } from '../../utils/rentalFilters';

interface TenancyApplicationModalProps {
  property: PublicPropertyListing | null;
  initialPreferredUnitId?: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onDismissError: () => void;
  onClose: () => void;
  onSubmit: (dto: CreateTenancyApplicationDto) => void;
}

export const TenancyApplicationModal: React.FC<TenancyApplicationModalProps> = ({
  property,
  initialPreferredUnitId = null,
  isSubmitting,
  submitError,
  onDismissError,
  onClose,
  onSubmit,
}) => {
  const [preferredUnitId, setPreferredUnitId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [monthlyIncomeUsd, setMonthlyIncomeUsd] = useState('6500');
  const [employmentStatus, setEmploymentStatus] = useState('full_time');
  const [desiredMoveInDate, setDesiredMoveInDate] = useState('');
  const [occupantsCount, setOccupantsCount] = useState('1');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!property) return;
    const validPreselected =
      initialPreferredUnitId &&
      property.vacant_units.some((u) => u.id === initialPreferredUnitId)
        ? initialPreferredUnitId
        : property.vacant_units[0]?.id || '';
    setPreferredUnitId(validPreselected);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setNotes('');
  }, [property, initialPreferredUnitId]);

  return (
    <ModalDialog
      isOpen={Boolean(property)}
      title={property ? `Tenancy Application — ${property.name}` : ''}
      subtitle="Submitted applications are sent straight to the property management team for review."
      titleId="apply-modal-title"
      maxWidthClass="max-w-xl"
      onClose={onClose}
    >
      {property && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              property_id: property.id,
              preferred_unit_id: preferredUnitId || null,
              applicant_first_name: firstName,
              applicant_last_name: lastName,
              applicant_email: email,
              applicant_phone: phone,
              monthly_income_cents: Math.max(0, Math.round(Number(monthlyIncomeUsd || 0) * 100)),
              employment_status: employmentStatus,
              desired_move_in_date: desiredMoveInDate || null,
              occupants_count: Math.max(1, Number(occupantsCount || 1)),
              notes: notes || undefined,
            });
          }}
          className="space-y-4"
        >
          {submitError && (
            <AlertBanner variant="error" message={submitError} onDismiss={onDismissError} />
          )}

          {property.vacant_units.length > 0 && (
            <div>
              <label
                htmlFor="app-preferred-unit"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Preferred Vacant Unit (Optional)
              </label>
              <select
                id="app-preferred-unit"
                value={preferredUnitId}
                onChange={(e) => setPreferredUnitId(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="">Any Available Unit</option>
                {property.vacant_units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_number} ({u.bedrooms === 0 ? 'Studio' : `${u.bedrooms}bd`} /{' '}
                    {u.bathrooms}ba, {u.square_feet} sqft
                    {u.monthly_rent_cents && u.monthly_rent_cents > 0
                      ? ` — ${formatMonthlyRent(u.monthly_rent_cents)}/mo`
                      : ''}
                    )
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="app-first-name" className="block text-xs font-semibold text-slate-700 mb-1">
                First Name
              </label>
              <input
                id="app-first-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jordan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="app-last-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Last Name
              </label>
              <input
                id="app-last-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Taylor"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="app-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="app-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="app-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                id="app-phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (206) 555-0190"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="app-income" className="block text-xs font-semibold text-slate-700 mb-1">
                Monthly Income (USD)
              </label>
              <input
                id="app-income"
                type="number"
                min="0"
                required
                value={monthlyIncomeUsd}
                onChange={(e) => setMonthlyIncomeUsd(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="app-employment" className="block text-xs font-semibold text-slate-700 mb-1">
                Employment
              </label>
              <select
                id="app-employment"
                value={employmentStatus}
                onChange={(e) => setEmploymentStatus(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="full_time">Full-Time</option>
                <option value="part_time">Part-Time</option>
                <option value="self_employed">Self-Employed</option>
                <option value="student">Student</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label htmlFor="app-occupants" className="block text-xs font-semibold text-slate-700 mb-1">
                Occupants
              </label>
              <input
                id="app-occupants"
                type="number"
                min="1"
                max="12"
                value={occupantsCount}
                onChange={(e) => setOccupantsCount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="app-move-in" className="block text-xs font-semibold text-slate-700 mb-1">
              Desired Move-In Date
            </label>
            <input
              id="app-move-in"
              type="date"
              value={desiredMoveInDate}
              onChange={(e) => setDesiredMoveInDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label htmlFor="app-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Notes for Property Manager
            </label>
            <textarea
              id="app-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Parking preferences, pets, references, or move-in flexibility..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-tenancy-application-btn"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Application'}</span>
            </button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
};

