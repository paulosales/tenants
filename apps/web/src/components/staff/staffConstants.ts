import { z } from 'zod';
import { Briefcase, ShieldAlert, Sparkles, UserCheck, Wrench } from 'lucide-react';
import type { StaffRole, StaffStatus } from '@tenants/shared-types';

export const staffSchema = z.object({
  property_id: z.string().min(1, 'Please select a property'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.enum(['manager', 'maintainer', 'security', 'cleaner', 'other']),
  title: z.string().min(2, 'Job title is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().min(5, 'Valid phone number is required'),
  specialization: z.string().optional(),
  shift: z.string().min(1, 'Shift schedule is required'),
  status: z.enum(['active', 'on_leave', 'inactive']),
});

export type StaffFormData = z.infer<typeof staffSchema>;

export const STAFF_ROLE_BADGES: Record<
  StaffRole,
  { label: string; bg: string; icon: typeof Briefcase }
> = {
  manager: {
    label: 'Property Manager',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Briefcase,
  },
  maintainer: {
    label: 'Technical Maintainer',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Wrench,
  },
  security: {
    label: 'Security & Safety',
    bg: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: ShieldAlert,
  },
  cleaner: {
    label: 'Housekeeping & Cleaning',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Sparkles,
  },
  other: {
    label: 'Operations Staff',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: UserCheck,
  },
};

export const STAFF_STATUS_BADGES: Record<StaffStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  on_leave: 'bg-amber-50 text-amber-700 border-amber-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const SPECIALIZATION_PLACEHOLDERS: Record<StaffRole, string> = {
  maintainer: 'e.g. Plumbing, HVAC & Heat Pumps, Electrical High Voltage',
  cleaner: 'e.g. Deep Sanitation, Pool & Pavilion Care',
  security: 'e.g. Biometric Access, CCTV & Fire Safety',
  manager: 'Key skills and focus areas',
  other: 'Key skills and focus areas',
};

