import React from 'react';
import { z } from 'zod';
import {
  Bug,
  DoorClosed,
  Droplets,
  Flame,
  Hammer,
  KeyRound,
  Refrigerator,
  Zap,
} from 'lucide-react';
import type {
  Amenity,
  AmenityBookingStatus,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
} from '@tenants/shared-types';

export const amenityBookingSchema = z.object({
  amenity_id: z.string().min(1, 'Please select an amenity'),
  booking_date: z.string().min(1, 'Booking date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  attendees_count: z.coerce.number().int().min(1, 'At least 1 attendee is required'),
  notes: z.string().optional(),
});

export type AmenityBookingFormData = z.infer<typeof amenityBookingSchema>;

export const maintenanceCallSchema = z.object({
  category: z.enum([
    'plumbing',
    'electrical',
    'hvac',
    'appliances',
    'locks_keys',
    'pest_control',
    'structural',
    'general',
  ] as const),
  priority: z.enum(['routine', 'urgent', 'emergency'] as const),
  unit_number: z.string().min(1, 'Unit number is required'),
  title: z.string().min(3, 'Please provide a clear title for the maintenance request'),
  description: z.string().min(10, 'Please provide at least 10 characters describing the issue'),
  permission_to_enter: z.boolean(),
  preferred_time_window: z.string().min(1, 'Please select a preferred time window'),
  contact_phone: z.string().min(7, 'A valid callback phone number is required'),
});

export type MaintenanceCallFormData = z.infer<typeof maintenanceCallSchema>;

export const DEFAULT_AMENITIES: Amenity[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Skyline Rooftop Lounge',
    description: 'Panoramic skyline views, private bar station, premium sound system, and lounge firepits.',
    capacity: 40,
    hourly_rate_cents: 5000,
    min_duration_minutes: 60,
    max_duration_minutes: 240,
    open_time_minutes: 600,
    close_time_minutes: 1380,
    is_active: true,
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Tennis & Pickleball Court',
    description: 'Championship-grade floodlit synthetic court with automated ball server and fresh equipment.',
    capacity: 4,
    hourly_rate_cents: 2500,
    min_duration_minutes: 60,
    max_duration_minutes: 120,
    open_time_minutes: 420,
    close_time_minutes: 1320,
    is_active: true,
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Heated Swimming Pool & Cabana',
    description: 'Resort-style 25m heated pool, hydrotherapy jacuzzi, private sun cabanas, and towel service.',
    capacity: 30,
    hourly_rate_cents: 0,
    min_duration_minutes: 60,
    max_duration_minutes: 180,
    open_time_minutes: 480,
    close_time_minutes: 1320,
    is_active: true,
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    name: '24/7 Wellness & Fitness Studio',
    description: 'State-of-the-art strength training suite, Peloton cycles, yoga studio, and steam room access.',
    capacity: 20,
    hourly_rate_cents: 0,
    min_duration_minutes: 60,
    max_duration_minutes: 120,
    open_time_minutes: 0,
    close_time_minutes: 1440,
    is_active: true,
  },
  {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    name: 'Outdoor BBQ & Dining Pavilion',
    description: 'Dual stainless steel natural gas grills, granite prep island, and covered pergola seating.',
    capacity: 25,
    hourly_rate_cents: 3500,
    min_duration_minutes: 60,
    max_duration_minutes: 240,
    open_time_minutes: 660,
    close_time_minutes: 1320,
    is_active: true,
  },
];

export const CATEGORY_INFO: Record<
  MaintenanceCategory,
  { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string }
> = {
  plumbing: { label: 'Plumbing', icon: Droplets, color: 'text-sky-500', bg: 'bg-sky-50 border-sky-200' },
  electrical: { label: 'Electrical', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
  hvac: { label: 'HVAC & Climate', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' },
  appliances: { label: 'Appliances', icon: Refrigerator, color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-200' },
  locks_keys: { label: 'Locks & Security', icon: KeyRound, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-200' },
  pest_control: { label: 'Pest Control', icon: Bug, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
  structural: { label: 'Structural / Doors', icon: DoorClosed, color: 'text-purple-500', bg: 'bg-purple-50 border-purple-200' },
  general: { label: 'General Repairs', icon: Hammer, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
};

export const PRIORITY_OPTIONS: Array<{
  level: MaintenancePriority;
  title: string;
  desc: string;
  border: string;
  activeBorder: string;
}> = [
  {
    level: 'routine',
    title: 'Routine',
    desc: 'Non-urgent (2 - 4 business days)',
    border: 'border-slate-200',
    activeBorder: 'border-indigo-600 bg-indigo-50/70',
  },
  {
    level: 'urgent',
    title: 'Urgent',
    desc: 'Requires prompt fix (24 - 48h)',
    border: 'border-slate-200',
    activeBorder: 'border-amber-500 bg-amber-50/70',
  },
  {
    level: 'emergency',
    title: 'Emergency',
    desc: 'Immediate on-call dispatch (Same Day)',
    border: 'border-slate-200',
    activeBorder: 'border-rose-600 bg-rose-50/70',
  },
];

export const SESSION_STATUS_BADGE: Record<AmenityBookingStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-slate-200 text-slate-600',
  completed: 'bg-slate-100 text-slate-800',
};

export const MAINTENANCE_STATUS_BADGE: Record<MaintenanceStatus, string> = {
  reported: 'bg-amber-100 text-amber-800',
  dispatched: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-sky-100 text-sky-800 animate-pulse',
  resolved: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-600',
};

export const PRIORITY_BADGE: Record<MaintenancePriority, string> = {
  emergency: 'bg-rose-100 text-rose-800 border border-rose-200',
  urgent: 'bg-amber-100 text-amber-800 border border-amber-200',
  routine: 'bg-slate-100 text-slate-700',
};

export const MAINTENANCE_PIPELINE_STEPS: Array<{ id: MaintenanceStatus; label: string }> = [
  { id: 'reported', label: 'Reported' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
];

