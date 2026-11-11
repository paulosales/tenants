import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { Role } from '@tenants/shared-types';
import { AlertBanner } from '../common/AlertBanner';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onNavigateToPortal: () => void;
}

interface RoleHint {
  role: Role;
  label: string;
  email: string;
  capabilities: string;
  badgeClass: string;
}

const ROLE_HINTS: RoleHint[] = [
  {
    role: 'super_admin',
    label: 'Administrator',
    email: 'admin@property.local',
    capabilities: 'Full portfolio access, staff, audit & resident portal oversight',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    role: 'property_manager',
    label: 'Property Manager',
    email: 'manager@property.local',
    capabilities: 'Applications, staff, parking assignment, amenity approvals & messaging',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    role: 'maintenance_staff',
    label: 'Maintainer',
    email: 'maintainer@property.local',
    capabilities: 'Receive maintenance dispatches, update status & resolve calls',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    role: 'staff',
    label: 'Building Staff',
    email: 'staff@property.local',
    capabilities: 'Team directory & direct messaging with Property Management',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    role: 'tenant',
    label: 'Tenant / Resident',
    email: 'tenant@property.local',
    capabilities: 'Resident View only: schedule amenities & submit maintenance calls',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onNavigateToPortal }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onLogin(trimmedEmail, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in with those credentials.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.22),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.16),_transparent_45%)] pointer-events-none" />

      <div className="max-w-5xl w-full mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Auth Card */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-2xl border border-slate-200 p-7 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    ApexLiving Portal
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Property & Tenant Operations Platform
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="back-to-public-portal-btn"
                onClick={onNavigateToPortal}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Public Property Portal</span>
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Sign in to your workspace</h2>
              <p className="text-sm text-slate-500 mt-1">
                Authenticate with your assigned role credentials to access authorized operations.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5">
                <AlertBanner
                  variant="error"
                  message={errorMsg}
                  onDismiss={() => setErrorMsg(null)}
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Work or Resident Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@property.local"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="login-submit-btn"
                disabled={isSubmitting}
                className="w-full py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>HttpOnly Cookie + CSRF Protected Session</span>
            </span>
            <span>HS256 + Argon2id</span>
          </div>
        </div>

        {/* Right Role Directory Panel */}
        <div className="lg:col-span-5 bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 p-7 text-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <UserCheck className="w-4 h-4" />
              <span>Role Directory</span>
            </div>
            <h3 className="text-lg font-bold text-white">Select an account identifier</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Click any role below to fill its workspace email, then enter your credentials to sign in.
              Check the application manual for seeded local development account details.
            </p>

            <div className="mt-5 space-y-2.5">
              {ROLE_HINTS.map((hint) => (
                <button
                  key={hint.role}
                  type="button"
                  onClick={() => {
                    setEmail(hint.email);
                    setErrorMsg(null);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-white group-hover:text-indigo-300 transition-colors">
                      {hint.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${hint.badgeClass}`}
                    >
                      {hint.role}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-indigo-300 mt-1">{hint.email}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{hint.capabilities}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-indigo-950/60 border border-indigo-800/60 text-xs text-indigo-200">
            Looking for an apartment instead? Return to the{' '}
            <button
              type="button"
              onClick={onNavigateToPortal}
              className="underline font-bold text-white hover:text-indigo-300 cursor-pointer"
            >
              Public Property Portal
            </button>{' '}
            to browse available units and apply without an account.
          </div>
        </div>
      </div>
    </div>
  );
};
