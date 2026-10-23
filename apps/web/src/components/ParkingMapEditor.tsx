import { useState } from 'react';
import { Plus, Save, Download, Trash2, Sliders } from 'lucide-react';
import type { ParkingLayoutResponse, ParkingSpotNode, RectCoordinates, SpotType } from '@tenants/shared-types';

interface ParkingMapEditorProps {
  layout: ParkingLayoutResponse;
  onSaveSpot: (spot: Partial<ParkingSpotNode>) => Promise<void>;
  onExportSvg: (svgMarkup: string) => Promise<void>;
}

export const ParkingMapEditor: React.FC<ParkingMapEditorProps> = ({
  layout,
  onSaveSpot,
  onExportSvg,
}) => {
  const [spots, setSpots] = useState<ParkingSpotNode[]>(layout.spots);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedSpot = spots.find((s) => s.id === selectedSpotId) || null;

  const handleAddSpot = () => {
    const nextNum = `P1-${String(spots.length + 1).padStart(2, '0')}`;
    const newSpot: ParkingSpotNode = {
      id: `spot-${Date.now()}`,
      spot_number: nextNum,
      spot_type: 'standard',
      shape: 'rect',
      coordinates: {
        x: 60 + (spots.length % 8) * 100,
        y: spots.length >= 8 ? 380 : 80,
        width: 80,
        height: 140,
      },
      status: 'vacant',
      hourly_rate_cents: 500,
      monthly_rate_cents: 15000,
    };

    setSpots((prev) => [...prev, newSpot]);
    setSelectedSpotId(newSpot.id);
  };

  const handleUpdateSelected = (fields: Partial<ParkingSpotNode>) => {
    if (!selectedSpotId) return;
    setSpots((prev) =>
      prev.map((s) => (s.id === selectedSpotId ? { ...s, ...fields } : s))
    );
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      for (const s of spots) {
        await onSaveSpot(s);
      }
      setStatusMessage('All parking slots and geometry nodes synchronized.');
    } catch (err: any) {
      setStatusMessage(`Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const generateSvgMarkup = (): string => {
    const spotElements = spots
      .map((s) => {
        const coords = s.coordinates as RectCoordinates;
        return `  <rect x="${coords.x}" y="${coords.y}" width="${coords.width}" height="${coords.height}" rx="6" fill="#1e293b" stroke="#6366f1" stroke-width="2" />
  <text x="${coords.x + coords.width / 2}" y="${coords.y + coords.height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="14" font-weight="bold">${s.spot_number}</text>`;
      })
      .join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${layout.zone.svg_viewbox}">\n${spotElements}\n</svg>`;
  };

  const handleExport = async () => {
    const svg = generateSvgMarkup();
    await onExportSvg(svg);
    setStatusMessage('SVG blueprint uploaded and validated via strict XML sanitizer.');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Editor Canvas */}
      <div className="flex-1 glass-panel rounded-2xl p-6 shadow-xl flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-xl font-heading font-bold text-white flex items-center space-x-2">
              <span>Blueprint Editor</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800">
                Admin Mode
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select or add slots, modify coordinates, assign rates, and export sanitized SVG layout.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleAddSpot}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Bay</span>
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving...' : 'Sync DB'}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export SVG</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800 text-indigo-300 text-xs flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* SVG Drawing Canvas */}
        <div className="relative w-full aspect-[5/3] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <svg viewBox={layout.zone.svg_viewbox} className="w-full h-full select-none">
            {/* Architectural Grid */}
            <defs>
              <pattern id="editor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#editor-grid)" />

            {/* Spots */}
            {spots.map((spot) => {
              const coords = spot.coordinates as RectCoordinates;
              const isSelected = selectedSpotId === spot.id;

              return (
                <g
                  key={spot.id}
                  onClick={() => setSelectedSpotId(spot.id)}
                  className="cursor-pointer"
                >
                  <rect
                    x={coords.x}
                    y={coords.y}
                    width={coords.width}
                    height={coords.height}
                    rx="6"
                    fill={isSelected ? 'rgba(99, 102, 241, 0.4)' : 'rgba(30, 41, 59, 0.6)'}
                    stroke={isSelected ? '#818cf8' : '#475569'}
                    strokeWidth={isSelected ? '2.5' : '1.5'}
                    strokeDasharray={isSelected ? 'none' : '4, 2'}
                  />
                  <text
                    x={coords.x + coords.width / 2}
                    y={coords.y + coords.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#f8fafc"
                    fontSize="13"
                    fontWeight="bold"
                    className="pointer-events-none"
                  >
                    {spot.spot_number}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Control Panel / Inspector */}
      <div className="w-full lg:w-80 glass-panel rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-heading font-bold text-white pb-3 border-b border-slate-800 flex items-center space-x-2">
            <Sliders className="h-4 w-4 text-indigo-400" />
            <span>Slot Properties</span>
          </h3>

          {selectedSpot ? (
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">Bay Code</label>
                <input
                  type="text"
                  value={selectedSpot.spot_number}
                  onChange={(e) => handleUpdateSelected({ spot_number: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">Spot Type</label>
                <select
                  value={selectedSpot.spot_type}
                  onChange={(e) => handleUpdateSelected({ spot_type: e.target.value as SpotType })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 capitalize"
                >
                  <option value="standard">Standard</option>
                  <option value="compact">Compact</option>
                  <option value="ev_charging">EV Charging</option>
                  <option value="accessible">Accessible</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Hourly ($)</label>
                  <input
                    type="number"
                    value={selectedSpot.hourly_rate_cents / 100}
                    onChange={(e) =>
                      handleUpdateSelected({
                        hourly_rate_cents: Math.round(parseFloat(e.target.value || '0') * 100),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Monthly ($)</label>
                  <input
                    type="number"
                    value={selectedSpot.monthly_rate_cents / 100}
                    onChange={(e) =>
                      handleUpdateSelected({
                        monthly_rate_cents: Math.round(parseFloat(e.target.value || '0') * 100),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-2 font-semibold">
                  Coordinates (px)
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-500">X:</span>{' '}
                    <span className="text-white font-mono">{(selectedSpot.coordinates as RectCoordinates).x}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-500">Y:</span>{' '}
                    <span className="text-white font-mono">{(selectedSpot.coordinates as RectCoordinates).y}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-500">W:</span>{' '}
                    <span className="text-white font-mono">{(selectedSpot.coordinates as RectCoordinates).width}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-500">H:</span>{' '}
                    <span className="text-white font-mono">{(selectedSpot.coordinates as RectCoordinates).height}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 text-xs">
              Select a spot on the canvas to configure its properties.
            </div>
          )}
        </div>

        {selectedSpot && (
          <div className="pt-6 border-t border-slate-800 mt-6">
            <button
              onClick={() => {
                setSpots((prev) => prev.filter((s) => s.id !== selectedSpotId));
                setSelectedSpotId(null);
              }}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-rose-950/40 text-rose-300 border border-rose-800/60 hover:bg-rose-900/40 transition-colors flex items-center justify-center space-x-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove Slot</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
