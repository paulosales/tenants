import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Car,
  Zap,
  Accessibility,
  Save,
  Trash2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  CheckCircle,
  Loader2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  PropertyWithStats,
  ParkingSpot,
  AdminSpotType,
  SaveParkingLayoutRequest,
} from '@tenants/shared-types';
import { SearchableSelect } from './SearchableSelect';

interface ParkingLayoutEditorProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string | null) => void;
}

const DEFAULT_SPOT_DIMS: Record<AdminSpotType, { width: number; height: number; labelPrefix: string }> = {
  standard: { width: 60, height: 120, labelPrefix: 'P' },
  compact: { width: 50, height: 100, labelPrefix: 'C' },
  ev_charging: { width: 60, height: 120, labelPrefix: 'EV' },
  handicap: { width: 80, height: 120, labelPrefix: 'ACC' },
};

export const ParkingLayoutEditor: React.FC<ParkingLayoutEditorProps> = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
}) => {
  const queryClient = useQueryClient();

  const activePropertyId = selectedPropertyId || (properties.length > 0 ? properties[0].id : '');

  // 1. Fetch layout and spots
  const { data: layoutData, isLoading } = useQuery({
    queryKey: ['parking-layout', activePropertyId],
    queryFn: () => (activePropertyId ? api.getAdminParkingLayout(activePropertyId) : Promise.reject('No property')),
    enabled: Boolean(activePropertyId),
  });

  // 2. Fetch tenants for spot assignment dropdown
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', activePropertyId],
    queryFn: () => api.getTenants({ property_id: activePropertyId || undefined }),
    enabled: Boolean(activePropertyId),
  });

  // Local editor state
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pan & Zoom state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Dragging Spot state
  const [draggingSpotId, setDraggingSpotId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync state when layout data arrives
  useEffect(() => {
    if (layoutData) {
      setCanvasWidth(layoutData.layout.canvas_width || 1200);
      setCanvasHeight(layoutData.layout.canvas_height || 800);
      setGridSize(layoutData.layout.grid_size || 20);
      setSpots(layoutData.spots || []);
      setSelectedSpotId(null);
      setIsDirty(false);
    }
  }, [layoutData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload: SaveParkingLayoutRequest) =>
      api.saveAdminParkingLayout(activePropertyId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['parking-layout', activePropertyId], data.data);
      setIsDirty(false);
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: any) => {
      setSaveError(err.message || 'Failed to save parking layout');
    },
  });

  // Add new spot
  const handleAddSpot = (type: AdminSpotType) => {
    const dim = DEFAULT_SPOT_DIMS[type];
    const spotCount = spots.filter((s) => s.spot_type === type).length + 1;
    const label = `${dim.labelPrefix}-${spotCount < 10 ? '0' : ''}${spotCount}`;

    // Place spot near visible center
    const centerX = snapToGrid ? Math.round((200 / gridSize)) * gridSize : 200;
    const centerY = snapToGrid ? Math.round((150 / gridSize)) * gridSize : 150;

    const newSpot: ParkingSpot = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      layout_id: layoutData?.layout.id || '',
      spot_label: label,
      x: centerX,
      y: centerY,
      width: dim.width,
      height: dim.height,
      rotation: 0,
      spot_type: type,
      is_occupied: false,
      assigned_tenant_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSpots((prev) => [...prev, newSpot]);
    setSelectedSpotId(newSpot.id);
    setIsDirty(true);
  };

  // Delete selected spot
  const handleDeleteSpot = (spotId: string) => {
    setSpots((prev) => prev.filter((s) => s.id !== spotId));
    if (selectedSpotId === spotId) {
      setSelectedSpotId(null);
    }
    setIsDirty(true);
  };

  // Update selected spot attribute
  const updateSelectedSpot = (updates: Partial<ParkingSpot>) => {
    if (!selectedSpotId) return;
    setSpots((prev) =>
      prev.map((s) => (s.id === selectedSpotId ? { ...s, ...updates } : s))
    );
    setIsDirty(true);
  };

  // Canvas Mouse Coordinates Helper
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      // Reverse pan & scale
      const x = (mouseX - pan.x) / scale;
      const y = (mouseY - pan.y) / scale;
      return { x, y };
    },
    [pan, scale]
  );

  // Mouse Down on Spot -> Start Dragging
  const handleSpotMouseDown = (e: React.MouseEvent, spot: ParkingSpot) => {
    e.stopPropagation();
    setSelectedSpotId(spot.id);
    setDraggingSpotId(spot.id);
    const coords = getCanvasCoords(e);
    setDragOffset({
      x: coords.x - spot.x,
      y: coords.y - spot.y,
    });
  };

  // Mouse Down on Canvas -> Start Pan (if background or middle click)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'rect') {
      setSelectedSpotId(null);
    }
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingSpotId) {
      const coords = getCanvasCoords(e);
      let newX = coords.x - dragOffset.x;
      let newY = coords.y - dragOffset.y;

      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      // Constrain within canvas bounds
      newX = Math.max(0, Math.min(newX, canvasWidth - 20));
      newY = Math.max(0, Math.min(newY, canvasHeight - 20));

      setSpots((prev) =>
        prev.map((s) => (s.id === draggingSpotId ? { ...s, x: newX, y: newY } : s))
      );
      setIsDirty(true);
    } else if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    setDraggingSpotId(null);
    setIsPanning(false);
  };

  // Handle Save
  const handleSaveLayout = () => {
    const payload: SaveParkingLayoutRequest = {
      canvas_width: canvasWidth,
      canvas_height: canvasHeight,
      grid_size: gridSize,
      spots: spots.map((s) => ({
        id: s.id.startsWith('new-') ? undefined : s.id,
        spot_label: s.spot_label,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        rotation: s.rotation,
        spot_type: s.spot_type,
        is_occupied: s.is_occupied,
        assigned_tenant_id: s.assigned_tenant_id,
      })),
    };
    saveMutation.mutate(payload);
  };

  const selectedSpot = spots.find((s) => s.id === selectedSpotId);

  return (
    <div className="space-y-4">
      {/* Visual Builder Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Property Switcher & Add Tools */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56">
            <SearchableSelect
              options={properties.map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: `${p.city}, ${p.state_province}`,
                badge: `${p.unit_count} units`,
              }))}
              value={activePropertyId}
              onChange={onSelectProperty}
              size="sm"
              placeholder="Select a property..."
              searchPlaceholder="Search properties..."
            />
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Add Spot Buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              id="btn-add-standard-spot"
              onClick={() => handleAddSpot('standard')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Add Standard Spot (60x120)"
            >
              <Car className="w-3.5 h-3.5 text-slate-600" />
              <span>Standard</span>
            </button>

            <button
              id="btn-add-ev-spot"
              onClick={() => handleAddSpot('ev_charging')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Add EV Charging Spot"
            >
              <Zap className="w-3.5 h-3.5 text-sky-600" />
              <span>EV</span>
            </button>

            <button
              id="btn-add-compact-spot"
              onClick={() => handleAddSpot('compact')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Add Compact Spot (50x100)"
            >
              <span>Compact</span>
            </button>

            <button
              id="btn-add-handicap-spot"
              onClick={() => handleAddSpot('handicap')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Add Accessible / Handicap Spot"
            >
              <Accessibility className="w-3.5 h-3.5 text-purple-600" />
              <span>Accessible</span>
            </button>
          </div>
        </div>

        {/* Right: Snapping, Pan/Zoom & Save Layout */}
        <div className="flex items-center space-x-2">
          {/* Snap toggle */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              snapToGrid
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'bg-slate-100 text-slate-500'
            }`}
            title="Snap coordinates to 20px grid"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Snap {gridSize}px</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 space-x-0.5">
            <button
              onClick={() => setScale((s) => Math.max(0.4, s - 0.15))}
              className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-600 px-1">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
              className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dirty Indicator & Save Button */}
          {isDirty && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 animate-pulse">
              Unsaved changes
            </span>
          )}

          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}

          <button
            id="btn-save-parking-layout"
            onClick={handleSaveLayout}
            disabled={saveMutation.isPending || !isDirty}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Layout</span>
          </button>
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Visual Workspace & Inspector Panel */}
      <div className="flex flex-col lg:flex-row gap-4 h-[680px]">
        {/* Interactive SVG Canvas Container */}
        <div
          className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-xs">Loading layout canvas...</p>
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="w-full h-full"
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            >
              <defs>
                {/* 20px Visual Snapping Grid Pattern */}
                <pattern
                  id="grid-pattern"
                  width={gridSize}
                  height={gridSize}
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx={gridSize} cy={gridSize} r="1" fill="#334155" opacity="0.6" />
                </pattern>
                {/* Canvas Background Fill */}
                <pattern
                  id="major-grid"
                  width={gridSize * 5}
                  height={gridSize * 5}
                  patternUnits="userSpaceOnUse"
                >
                  <rect width={gridSize * 5} height={gridSize * 5} fill="none" stroke="#1e293b" strokeWidth="0.75" />
                </pattern>
              </defs>

              {/* Pan & Zoom Group */}
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
                {/* Canvas Bounds Background */}
                <rect
                  x="0"
                  y="0"
                  width={canvasWidth}
                  height={canvasHeight}
                  fill="#090d16"
                  stroke="#334155"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="url(#grid-pattern)" />
                <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="url(#major-grid)" opacity="0.5" />

                {/* Driving Lane Markings */}
                <line
                  x1="20"
                  y1={canvasHeight / 2}
                  x2={canvasWidth - 20}
                  y2={canvasHeight / 2}
                  stroke="#334155"
                  strokeWidth="2"
                  strokeDasharray="16 12"
                  opacity="0.4"
                />

                {/* Render All Parking Spots */}
                {spots.map((spot) => {
                  const isSelected = spot.id === selectedSpotId;
                  const isOccupied = spot.is_occupied;

                  // Color themes by Spot Type & Occupancy
                  let strokeColor = '#10b981'; // vacant emerald
                  let fillColor = '#064e3b22';
                  let badgeBg = '#065f46';
                  let badgeText = '#a7f3d0';

                  if (isOccupied) {
                    strokeColor = '#6366f1'; // occupied indigo
                    fillColor = '#312e8133';
                    badgeBg = '#3730a3';
                    badgeText = '#c7d2fe';
                  }

                  if (spot.spot_type === 'ev_charging') {
                    strokeColor = isOccupied ? '#38bdf8' : '#0284c7';
                    fillColor = '#0c4a6e33';
                  } else if (spot.spot_type === 'handicap') {
                    strokeColor = isOccupied ? '#c084fc' : '#9333ea';
                    fillColor = '#581c8733';
                  }

                  if (isSelected) {
                    strokeColor = '#38bdf8'; // bright cyan highlight ring
                  }

                  // Find assigned tenant name if any
                  const assignedTenant = tenants.find((t) => t.id === spot.assigned_tenant_id);
                  const tenantLabel = assignedTenant
                    ? `${assignedTenant.first_name} ${assignedTenant.last_name[0]}.`
                    : null;

                  return (
                    <g
                      key={spot.id}
                      transform={`translate(${spot.x}, ${spot.y}) rotate(${spot.rotation || 0}, ${spot.width / 2}, ${spot.height / 2})`}
                      onMouseDown={(e) => handleSpotMouseDown(e, spot)}
                      className="cursor-move group"
                    >
                      {/* Selection Glow / Drop Shadow */}
                      {isSelected && (
                        <rect
                          x="-4"
                          y="-4"
                          width={spot.width + 8}
                          height={spot.height + 8}
                          rx="8"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          className="animate-pulse"
                        />
                      )}

                      {/* Main Spot Box */}
                      <rect
                        x="0"
                        y="0"
                        width={spot.width}
                        height={spot.height}
                        rx="6"
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? '2.5' : '1.75'}
                        className="transition-all"
                      />

                      {/* Top Spot Label Banner */}
                      <rect x="0" y="0" width={spot.width} height="22" rx="6" fill={badgeBg} opacity="0.85" />
                      <text
                        x={spot.width / 2}
                        y="15"
                        textAnchor="middle"
                        fill={badgeText}
                        fontSize="11"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {spot.spot_label}
                      </text>

                      {/* Spot Type Icon Badge in center */}
                      {spot.spot_type === 'ev_charging' && (
                        <g transform={`translate(${spot.width / 2 - 8}, ${spot.height / 2 - 14})`}>
                          <circle cx="8" cy="8" r="10" fill="#0284c7" opacity="0.8" />
                          <path
                            d="M8 3L4 9h4l-1 5 6-7h-4l1-4z"
                            fill="#ffffff"
                            transform="scale(0.8) translate(2, 2)"
                          />
                        </g>
                      )}

                      {spot.spot_type === 'handicap' && (
                        <g transform={`translate(${spot.width / 2 - 7}, ${spot.height / 2 - 14})`}>
                          <circle cx="7" cy="7" r="9" fill="#9333ea" opacity="0.8" />
                          <text x="7" y="11" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
                            ♿
                          </text>
                        </g>
                      )}

                      {/* Occupancy Indicator / Tenant Name */}
                      <text
                        x={spot.width / 2}
                        y={spot.height - 12}
                        textAnchor="middle"
                        fill={isOccupied ? '#cbd5e1' : '#6ee7b7'}
                        fontSize="9.5"
                        fontWeight="600"
                      >
                        {isOccupied ? tenantLabel || 'OCCUPIED' : 'VACANT'}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {/* Canvas Bottom Stats Overlay */}
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-center space-x-3 pointer-events-none">
            <span>
              Canvas: {canvasWidth}x{canvasHeight}px
            </span>
            <span>•</span>
            <span>Spots: {spots.length}</span>
            <span>•</span>
            <span className="text-emerald-400">
              Vacant: {spots.filter((s) => !s.is_occupied).length}
            </span>
            <span>•</span>
            <span className="text-indigo-400">
              Occupied: {spots.filter((s) => s.is_occupied).length}
            </span>
          </div>
        </div>

        {/* Right Inspector Panel */}
        <div className="w-full lg:w-80 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Spot Inspector</h3>
              <p className="text-[11px] text-slate-400">
                {selectedSpot ? `Editing ${selectedSpot.spot_label}` : 'Click a spot to inspect'}
              </p>
            </div>
            {selectedSpot && (
              <button
                onClick={() => setSelectedSpotId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {selectedSpot ? (
            <div className="p-5 space-y-4 flex-1 overflow-y-auto text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Spot Label</label>
                <input
                  type="text"
                  value={selectedSpot.spot_label}
                  onChange={(e) => updateSelectedSpot({ spot_label: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Spot Type</label>
                <SearchableSelect
                  options={[
                    { value: 'standard', label: 'Standard Vehicle', badge: 'Standard', badgeColor: 'indigo' },
                    { value: 'compact', label: 'Compact Only', badge: 'Compact', badgeColor: 'slate' },
                    { value: 'ev_charging', label: 'EV Charging Station', badge: 'EV Charging', badgeColor: 'emerald' },
                    { value: 'handicap', label: 'Accessible / Handicap', badge: 'Handicap', badgeColor: 'amber' },
                  ]}
                  value={selectedSpot.spot_type}
                  onChange={(val) => updateSelectedSpot({ spot_type: val as AdminSpotType })}
                  placeholder="Select spot type..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Width (px)</label>
                  <input
                    type="number"
                    value={selectedSpot.width}
                    onChange={(e) => updateSelectedSpot({ width: Number(e.target.value) || 60 })}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Height (px)</label>
                  <input
                    type="number"
                    value={selectedSpot.height}
                    onChange={(e) => updateSelectedSpot({ height: Number(e.target.value) || 120 })}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Rotation</label>
                  <span className="text-xs font-mono text-slate-500">{selectedSpot.rotation}°</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="15"
                    value={selectedSpot.rotation || 0}
                    onChange={(e) => updateSelectedSpot({ rotation: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                  <button
                    onClick={() =>
                      updateSelectedSpot({
                        rotation: ((selectedSpot.rotation || 0) + 90) % 360,
                      })
                    }
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Assigned Tenant */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Tenant
                </label>
                <SearchableSelect
                  options={[
                    { value: 'none', label: '-- Unassigned --' },
                    ...tenants.map((t) => ({
                      value: t.id,
                      label: `${t.first_name} ${t.last_name}`,
                      sublabel: t.email,
                      badge: t.unit_number ? `Unit ${t.unit_number}` : undefined,
                      badgeColor: 'emerald' as const,
                    })),
                  ]}
                  value={selectedSpot.assigned_tenant_id || 'none'}
                  onChange={(val) => {
                    const tenantId = val === 'none' ? null : val;
                    updateSelectedSpot({
                      assigned_tenant_id: tenantId,
                      is_occupied: Boolean(tenantId),
                    });
                  }}
                  placeholder="Search and assign tenant..."
                  searchPlaceholder="Type tenant name, unit, or email..."
                  emptyMessage="No tenants found"
                  allowClear={true}
                  clearLabel="-- Unassigned --"
                  clearValue="none"
                />
              </div>

              {/* Occupied Toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="spot_occupied_toggle"
                  checked={selectedSpot.is_occupied}
                  onChange={(e) => updateSelectedSpot({ is_occupied: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="spot_occupied_toggle" className="text-xs font-medium text-slate-700 select-none">
                  Mark spot as occupied
                </label>
              </div>

              {/* Delete Spot */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => handleDeleteSpot(selectedSpot.id)}
                  className="w-full flex items-center justify-center space-x-2 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Spot</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center flex-1 flex flex-col items-center justify-center text-slate-400">
              <Car className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs font-medium text-slate-500">No Spot Selected</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                Click any parking space on the canvas to inspect dimensions, rotation, and tenant assignment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
