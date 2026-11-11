import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  DoorOpen,
  LogIn,
  MapPin,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { PublicPropertyListing } from '@tenants/shared-types';
import { usePublicPortalGateway } from '../../context/ApiContext';
import { AlertBanner } from '../common/AlertBanner';

interface PublicPortalViewProps {
  onOpenLogin: () => void;
}

export const PublicPortalView: React.FC<PublicPortalViewProps> = ({ onOpenLogin }) => {
  const publicGateway = usePublicPortalGateway();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<PublicPropertyListing | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Application form fields
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

  const {
    data: properties = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public-properties'],
    queryFn: () => publicGateway.getPublicProperties(),
  });

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state_province.toLowerCase().includes(q) ||
        p.address_line1.toLowerCase().includes(q)
    );
  }, [properties, searchQuery]);

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!selectedProperty) throw new Error('No property selected');
      return publicGateway.submitPublicApplication({
        property_id: selectedProperty.id,
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
    },
    onSuccess: (res) => {
      const managersText =
        res.managers_notified > 0
          ? `Routed to ${res.managers_notified} property manager(s) at ${selectedProperty?.name}.`
          : `Sent to the property management team at ${selectedProperty?.name}.`;
      setConfirmationMsg(`${res.message} ${managersText}`);
      setSubmitError(null);
      setSelectedProperty(null);
      setPreferredUnitId('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setNotes('');
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit application');
    },
  });

  const openApplicationModal = (property: PublicPropertyListing) => {
    setSelectedProperty(property);
    setPreferredUnitId(property.vacant_units[0]?.id || '');
    setSubmitError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                ApexLiving Residences
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Public Leasing Portal
              </span>
            </div>
          </div>

          <button
            id="open-login-btn"
            onClick={onOpenLogin}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In to Workspace</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>No account required to browse and apply</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Find your next residence and apply directly to property management
            </h1>
            <p className="text-slate-300 mt-3 text-sm sm:text-base leading-relaxed">
              Explore managed residential towers, inspect real-time unit availability and resort-grade
              amenities, and submit your tenancy application in under two minutes.
            </p>
          </div>

          <div className="w-full lg:w-96">
            <label htmlFor="public-property-search" className="sr-only">
              Search properties
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                id="public-property-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by building name, city, or street..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white/15"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 space-y-6">
        {confirmationMsg && (
          <AlertBanner
            variant="success"
            message={confirmationMsg}
            onDismiss={() => setConfirmationMsg(null)}
          />
        )}

        {error && (
          <AlertBanner
            variant="error"
            message={error instanceof Error ? error.message : 'Unable to load available properties.'}
          />
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((skeleton) => (
              <div
                key={skeleton}
                className="h-72 rounded-3xl bg-white border border-slate-200 p-6 animate-pulse"
              />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">No Matching Properties Found</h3>
            <p className="text-sm text-slate-500 mt-1">
              Try clearing your search filter to see all residential communities accepting applications.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProperties.map((property) => (
              <article
                key={property.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
              >
                <div className="p-6 sm:p-7 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          property.available_units > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <DoorOpen className="w-3.5 h-3.5" />
                        <span>
                          {property.available_units > 0
                            ? `${property.available_units} Vacant Units Available`
                            : 'Join Waitlist / Pre-Leasing'}
                        </span>
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 mt-2.5">{property.name}</h2>
                      <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>
                          {property.address_line1}
                          {property.address_line2 ? `, ${property.address_line2}` : ''},{' '}
                          {property.city}, {property.state_province} {property.postal_code}
                        </span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-slate-400 uppercase block">
                        Total Units
                      </span>
                      <span className="text-2xl font-extrabold text-slate-900">
                        {property.total_units}
                      </span>
                    </div>
                  </div>

                  {/* Vacant Units Preview */}
                  {property.vacant_units.length > 0 && (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Available Floorplans
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {property.vacant_units.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                          >
                            Unit {u.unit_number} · {u.bedrooms}bd / {u.bathrooms}ba ·{' '}
                            {u.square_feet.toLocaleString()} sqft
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Amenities Preview */}
                  {property.amenities.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Community Amenities
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {property.amenities.map((amenityName) => (
                          <span
                            key={amenityName}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium"
                          >
                            {amenityName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 sm:px-7 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500 inline-flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {property.manager_count > 0
                        ? `${property.manager_count} on-site property manager(s)`
                        : 'Managed community'}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => openApplicationModal(property)}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Apply to Be a Tenant</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Tenancy Application Modal */}
      {selectedProperty && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="apply-modal-title"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h2 id="apply-modal-title" className="text-lg font-bold text-slate-900">
                  Tenancy Application — {selectedProperty.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submitted applications are sent straight to the property management team for review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Close application modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              {submitError && (
                <AlertBanner
                  variant="error"
                  message={submitError}
                  onDismiss={() => setSubmitError(null)}
                />
              )}

              {selectedProperty.vacant_units.length > 0 && (
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">Any Available Unit</option>
                    {selectedProperty.vacant_units.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_number} ({u.bedrooms}bd / {u.bathrooms}ba, {u.square_feet} sqft)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="app-first-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
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
                  <label
                    htmlFor="app-last-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
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
                  <label
                    htmlFor="app-email"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
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
                  <label
                    htmlFor="app-phone"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
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
                  <label
                    htmlFor="app-income"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
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
                  <label
                    htmlFor="app-employment"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Employment
                  </label>
                  <select
                    id="app-employment"
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="full_time">Full-Time</option>
                    <option value="part_time">Part-Time</option>
                    <option value="self_employed">Self-Employed</option>
                    <option value="student">Student</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="app-occupants"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
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
                <label
                  htmlFor="app-move-in"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
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
                <label
                  htmlFor="app-notes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
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
                  onClick={() => setSelectedProperty(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-tenancy-application-btn"
                  disabled={applyMutation.isPending}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{applyMutation.isPending ? 'Submitting...' : 'Submit Application'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

