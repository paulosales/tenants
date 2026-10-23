export const tokens = {
  colors: {
    primary: {
      50: '#eef2ff',
      100: '#e0e7ff',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      900: '#312e81',
    },
    emerald: {
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
    },
    amber: {
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
    },
    rose: {
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
    },
    slate: {
      800: '#1e293b',
      850: '#172033',
      900: '#0f172a',
      950: '#020617',
    },
  },
  parkingColors: {
    vacant: {
      fill: 'rgba(16, 185, 129, 0.25)',
      stroke: '#10b981',
      label: 'Vacant',
    },
    reserved: {
      fill: 'rgba(245, 158, 11, 0.25)',
      stroke: '#f59e0b',
      label: 'Reserved',
    },
    occupied: {
      fill: 'rgba(244, 63, 94, 0.25)',
      stroke: '#f43f5e',
      label: 'Occupied',
    },
    maintenance: {
      fill: 'rgba(100, 116, 139, 0.25)',
      stroke: '#64748b',
      label: 'Maintenance',
    },
    selected: {
      fill: 'rgba(99, 102, 241, 0.45)',
      stroke: '#818cf8',
      label: 'Selected',
    },
  },
  radii: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  shadows: {
    glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    glowPrimary: '0 0 20px -3px rgba(99, 102, 241, 0.4)',
    glowEmerald: '0 0 20px -3px rgba(16, 185, 129, 0.4)',
  },
} as const;
