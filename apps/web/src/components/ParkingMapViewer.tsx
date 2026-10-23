import { useState } from 'react';
import { Zap, Accessibility, Car, Check, Info } from 'lucide-react';
import type { ParkingLayoutResponse, ParkingSpotNode, RectCoordinates } from '@tenants/shared-types';
import { tokens } from '@tenants/shared-ui';

interface ParkingMapViewerProps {
  layout: ParkingLayoutResponse;
  onReserveSpot: (spotId: string) => Promise<void>;
  isLoading?: boolean;
}

export const ParkingMapViewer: React.FC<ParkingMapViewerProps> = ({
  layout,
  onReserveSpot,
  isLoading = false,
}) => {
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpotNode | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSpotClick = (spot: ParkingSpotNode) => {
    setSelectedSpot(spot);
    setFeedback(null);
  };

  const handleConfirmReservation = async () => {
    if (!selectedSpot) return;
    setIsReserving(true);
    setFeedback(null);
    try {
      await onReserveSpot(selectedSpot.id);
      setFeedback({ type: 'success', message: `Spot ${selectedSpot.spot_number} successfully reserved!` });
      // Update local state to reflect reserved
      setSelectedSpot((prev) => (prev ? { ...prev, status: 'reserved' } : null));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reserve spot' });
    } finally {
      setIsReserving(false);
    }
  };

  const getSpotColor = (spot: ParkingSpotNode) => {
    if (selectedSpot?.id === spot.id) {
      return tokens.parkingColors.selected;
    }
    return tokens.parkingColors[spot.status] || tokens.parkingColors.vacant;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* SVG Map Canvas */}
      <div className="flex-1 glass-panel rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden flex flex-col">
        {/* Map Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-heading font-bold text-white flex items-center space-x-2">
              <span>{layout.zone.name}</span>
              <span className="text-xs font-normal text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                Floor {layout.zone.floor_level}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select any highlighted vacant parking slot to view details and reserve.
            </p>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500/30 border border-emerald-400"></span>
              <span className="text-slate-300">Vacant</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500/30 border border-amber-400"></span>
              <span className="text-slate-300">Reserved</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500/30 border border-rose-400"></span>
              <span className="text-slate-300">Occupied</span>
            </div>
          </div>
        </div>

        {/* Dynamic SVG Container */}
        <div className="relative w-full aspect-[5/3] bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
          <svg
            viewBox={layout.zone.svg_viewbox}
            className="w-full h-full select-none cursor-crosshair"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Garage Architecture Grid lines & Driving Lane */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Central Driving Lane Lane Markers */}
            <rect x="0" y="240" width="1000" height="120" fill="rgba(15, 23, 42, 0.6)" />
            <line x1="0" y1="300" x2="1000" y2="300" stroke="#facc15" strokeWidth="2" strokeDasharray="16, 12" />

            {/* Parking Spots */}
            {layout.spots.map((spot) => {
              const color = getSpotColor(spot);
              const isRect = spot.shape === 'rect' && 'x' in spot.coordinates;

              if (isRect) {
                const coords = spot.coordinates as RectCoordinates;
                const isSelected = selectedSpot?.id === spot.id;

                return (
                  <g
                    key={spot.id}
                    onClick={() => handleSpotClick(spot)}
                    className="cursor-pointer transition-all duration-200"
                  >
                    <rect
                      x={coords.x}
                      y={coords.y}
                      width={coords.width}
                      height={coords.height}
                      rx="6"
                      fill={color.fill}
                      stroke={color.stroke}
                      strokeWidth={isSelected ? '3' : '1.5'}
                      className="transition-colors hover:brightness-125"
                    />

                    {/* Spot Number Text */}
                    <text
                      x={coords.x + coords.width / 2}
                      y={coords.y + coords.height / 2 - 8}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#f8fafc"
                      fontSize="14"
                      fontWeight="bold"
                      className="pointer-events-none tracking-wider"
                    >
                      {spot.spot_number}
                    </text>

                    {/* Spot Type Icon or Subtitle */}
                    <text
                      x={coords.x + coords.width / 2}
                      y={coords.y + coords.height / 2 + 14}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={spot.status === 'vacant' ? '#10b981' : '#94a3b8'}
                      fontSize="10"
                      fontWeight="600"
                      className="pointer-events-none uppercase"
                    >
                      {spot.spot_type.replace('_', ' ')}
                    </text>
                  </g>
                );
              }

              return null;
            })}
          </svg>
        </div>
      </div>

      {/* Spot Details Drawer / Sidebar */}
      <div className="w-full lg:w-80 glass-panel rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-heading font-bold text-white pb-3 border-b border-slate-800 flex items-center justify-between">
            <span>Spot Details</span>
            {selectedSpot && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize" style={{
                backgroundColor: tokens.parkingColors[selectedSpot.status]?.fill,
                color: tokens.parkingColors[selectedSpot.status]?.stroke,
              }}>
                {selectedSpot.status}
              </span>
            )}
          </h3>

          {selectedSpot ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400">Slot Identifier</span>
                <span className="text-base font-bold text-white font-mono">{selectedSpot.spot_number}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400">Bay Category</span>
                <span className="text-xs font-semibold text-indigo-400 flex items-center space-x-1 capitalize">
                  {selectedSpot.spot_type === 'ev_charging' && <Zap className="h-3.5 w-3.5 text-amber-400" />}
                  {selectedSpot.spot_type === 'accessible' && <Accessibility className="h-3.5 w-3.5 text-blue-400" />}
                  <span>{selectedSpot.spot_type.replace('_', ' ')}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Hourly Rate</span>
                  <span className="text-sm font-bold text-white">${(selectedSpot.hourly_rate_cents / 100).toFixed(2)}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Monthly Rate</span>
                  <span className="text-sm font-bold text-white">${(selectedSpot.monthly_rate_cents / 100).toFixed(2)}</span>
                </div>
              </div>

              {feedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                }`}>
                  <Info className="h-4 w-4 shrink-0" />
                  <span>{feedback.message}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500">
              <Car className="h-10 w-10 mx-auto mb-3 opacity-40 text-slate-400" />
              <p className="text-xs">Click on any parking spot on the interactive blueprint to reserve.</p>
            </div>
          )}
        </div>

        {selectedSpot && (
          <div className="pt-6 border-t border-slate-800 mt-6">
            <button
              onClick={handleConfirmReservation}
              disabled={selectedSpot.status !== 'vacant' || isReserving || isLoading}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-lg ${
                selectedSpot.status === 'vacant'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/25 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {isReserving ? (
                <span>Securing Spot...</span>
              ) : selectedSpot.status === 'vacant' ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Reserve Spot {selectedSpot.spot_number}</span>
                </>
              ) : (
                <span>Spot Unavailable</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
