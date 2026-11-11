import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  CheckCircle2,
  FileText,
  ImagePlus,
  MapPin,
  Plus,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { PropertyFeature, PropertyPhoto, PropertyWithStats } from '@tenants/shared-types';
import { usePropertiesGateway } from '../../context/ApiContext';
import { sanitizeRichHtml } from '../../utils/htmlSanitizer';
import { AlertBanner } from '../common/AlertBanner';
import { ConfirmModal } from '../common/ConfirmModal';
import { ModalDialog } from '../common/ModalDialog';
import { RichTextEditor } from '../common/RichTextEditor';

interface PropertyShowcaseModalProps {
  property: PropertyWithStats | null;
  onClose: () => void;
}

type TabKey = 'description' | 'features' | 'photos';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const FEATURE_CATEGORIES = [
  { value: 'community', label: 'Community & Building' },
  { value: 'suite', label: 'In-Suite Finishes' },
  { value: 'utilities', label: 'Utilities & Energy' },
  { value: 'policies', label: 'Policies & Parking' },
  { value: 'transit', label: 'Transit & Location' },
];

export const PropertyShowcaseModal: React.FC<PropertyShowcaseModalProps> = ({
  property,
  onClose,
}) => {
  const propertiesGateway = usePropertiesGateway();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('description');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Showcase / Description / Geo form state
  const [richDescription, setRichDescription] = useState('');
  const [latitudeStr, setLatitudeStr] = useState('');
  const [longitudeStr, setLongitudeStr] = useState('');
  const [petPolicy, setPetPolicy] = useState('');
  const [leaseTerms, setLeaseTerms] = useState('');

  // Feature add form state
  const [newFeatureLabel, setNewFeatureLabel] = useState('');
  const [newFeatureCategory, setNewFeatureCategory] = useState('community');

  // Photo upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [isCoverUpload, setIsCoverUpload] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<PropertyPhoto | null>(null);

  const propertyId = property?.id ?? '';

  const { data: fullProperty } = useQuery({
    queryKey: ['property-detail', propertyId],
    queryFn: () => propertiesGateway.getProperty(propertyId),
    enabled: Boolean(propertyId),
  });

  const { data: features = [], isLoading: featuresLoading } = useQuery({
    queryKey: ['property-features', propertyId],
    queryFn: () => propertiesGateway.getPropertyFeatures(propertyId),
    enabled: Boolean(propertyId),
  });

  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['property-photos', propertyId],
    queryFn: () => propertiesGateway.getPropertyPhotos(propertyId),
    enabled: Boolean(propertyId),
  });

  useEffect(() => {
    const source = fullProperty || property;
    if (!source) return;
    setRichDescription(source.rich_description || '');
    setLatitudeStr(
      typeof source.latitude === 'number' && Number.isFinite(source.latitude)
        ? String(source.latitude)
        : ''
    );
    setLongitudeStr(
      typeof source.longitude === 'number' && Number.isFinite(source.longitude)
        ? String(source.longitude)
        : ''
    );
    setPetPolicy(source.pet_policy || '');
    setLeaseTerms(source.lease_terms || '');
  }, [fullProperty, property]);

  const invalidateShowcaseQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    queryClient.invalidateQueries({ queryKey: ['public-properties'] });
    queryClient.invalidateQueries({ queryKey: ['public-property-detail', propertyId] });
    queryClient.invalidateQueries({ queryKey: ['property-detail', propertyId] });
    queryClient.invalidateQueries({ queryKey: ['property-features', propertyId] });
    queryClient.invalidateQueries({ queryKey: ['property-photos', propertyId] });
  };

  const saveShowcaseMutation = useMutation({
    mutationFn: async () => {
      if (!property) throw new Error('No property selected');
      const lat = latitudeStr.trim() ? Number(latitudeStr.trim()) : null;
      const lng = longitudeStr.trim() ? Number(longitudeStr.trim()) : null;

      if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        throw new Error('Latitude must be between -90 and 90.');
      }
      if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        throw new Error('Longitude must be between -180 and 180.');
      }

      const source = fullProperty || property;
      return propertiesGateway.updateProperty(property.id, {
        name: source.name,
        address_line1: source.address_line1,
        address_line2: source.address_line2 || undefined,
        city: source.city,
        state_province: source.state_province,
        postal_code: source.postal_code,
        rich_description: sanitizeRichHtml(richDescription),
        latitude: lat,
        longitude: lng,
        pet_policy: petPolicy.trim() || undefined,
        lease_terms: leaseTerms.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidateShowcaseQueries();
      setErrorMessage(null);
      setStatusMessage('Property showcase, rich description, and map coordinates saved.');
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save showcase');
    },
  });

  const addFeatureMutation = useMutation({
    mutationFn: () => {
      const label = newFeatureLabel.trim();
      if (label.length < 2) {
        throw new Error('Feature label must be at least 2 characters.');
      }
      return propertiesGateway.addPropertyFeature(propertyId, {
        label,
        category: newFeatureCategory,
        display_order: features.length,
      });
    },
    onSuccess: () => {
      setNewFeatureLabel('');
      invalidateShowcaseQueries();
      setErrorMessage(null);
      setStatusMessage('Feature added and synced to the public property showcase.');
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to add feature');
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: (feature: PropertyFeature) =>
      propertiesGateway.deletePropertyFeature(propertyId, feature.id),
    onSuccess: () => {
      invalidateShowcaseQueries();
      setErrorMessage(null);
      setStatusMessage('Feature removed from showcase.');
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove feature');
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('Select a JPEG, PNG, or WebP photo first.');
      if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
        throw new Error('Only JPEG, PNG, and WebP images are supported.');
      }
      if (selectedFile.size > MAX_UPLOAD_BYTES) {
        throw new Error('Image exceeds the 5 MB upload limit.');
      }
      return propertiesGateway.uploadPropertyPhoto(propertyId, selectedFile, {
        caption: photoCaption.trim() || undefined,
        isCover: isCoverUpload || photos.length === 0,
      });
    },
    onSuccess: () => {
      setSelectedFile(null);
      setPhotoCaption('');
      setIsCoverUpload(false);
      invalidateShowcaseQueries();
      setErrorMessage(null);
      setStatusMessage('Photo uploaded to S3 / MinIO CDN and attached to gallery.');
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Photo upload failed');
    },
  });

  const setCoverMutation = useMutation({
    mutationFn: (photoId: string) => propertiesGateway.setCoverPropertyPhoto(propertyId, photoId),
    onSuccess: () => {
      invalidateShowcaseQueries();
      setErrorMessage(null);
      setStatusMessage('Primary cover photo updated.');
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update cover photo');
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photo: PropertyPhoto) =>
      propertiesGateway.deletePropertyPhoto(propertyId, photo.id),
    onSuccess: () => {
      setPhotoToDelete(null);
      invalidateShowcaseQueries();
      setErrorMessage(null);
      setStatusMessage('Photo deleted from CDN storage.');
    },
    onError: (err) => {
      setPhotoToDelete(null);
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove photo');
    },
  });

  if (!property) return null;

  return (
    <ModalDialog
      isOpen={Boolean(property)}
      onClose={onClose}
      title={`Showcase & Media: ${property.name}`}
      subtitle={`${property.address_line1}, ${property.city}, ${property.state_province}`}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-5">
        {statusMessage && (
          <AlertBanner
            variant="success"
            message={statusMessage}
            onDismiss={() => setStatusMessage(null)}
          />
        )}
        {errorMessage && (
          <AlertBanner
            variant="error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('description')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'description'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Description &amp; Map Location</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'features'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Features ({features.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>CDN Photos ({photos.length})</span>
          </button>
        </div>

        {/* TAB 1: Rich-Text Description & Geo Location */}
        {activeTab === 'description' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Rich Property Description (Sanitized HTML)
              </label>
              <RichTextEditor value={richDescription} onChange={setRichDescription} />
              <p className="text-[11px] text-slate-400 mt-1">
                Scripts, event handlers, and unsafe tags are automatically stripped via DOMPurify +
                server HTML allow-list verification.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pet Policy
                </label>
                <input
                  type="text"
                  value={petPolicy}
                  onChange={(e) => setPetPolicy(e.target.value)}
                  placeholder="e.g. Cats & dogs welcome (max 2 pets)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lease Terms
                </label>
                <input
                  type="text"
                  value={leaseTerms}
                  onChange={(e) => setLeaseTerms(e.target.value)}
                  placeholder="e.g. 6 or 12-month leases · Water & heat included"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  Google Maps Geo-Coordinates
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLatitudeStr('49.8951');
                      setLongitudeStr('-97.1384');
                    }}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Winnipeg Center
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLatitudeStr('47.6062');
                      setLongitudeStr('-122.3321');
                    }}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Seattle Downtown
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={latitudeStr}
                    onChange={(e) => setLatitudeStr(e.target.value)}
                    placeholder="49.9612"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={longitudeStr}
                    onChange={(e) => setLongitudeStr(e.target.value)}
                    placeholder="-97.1394"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={saveShowcaseMutation.isPending}
                onClick={() => saveShowcaseMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm disabled:opacity-60 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {saveShowcaseMutation.isPending ? 'Saving...' : 'Save Showcase & Location'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Features Manager */}
        {activeTab === 'features' && (
          <div className="space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addFeatureMutation.mutate();
              }}
              className="flex flex-col sm:flex-row gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-4"
            >
              <input
                type="text"
                aria-label="New property feature label"
                value={newFeatureLabel}
                onChange={(e) => setNewFeatureLabel(e.target.value)}
                placeholder="e.g. In-Suite Washer & Dryer, Heated Underground Parking..."
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
              />
              <select
                aria-label="Feature category"
                value={newFeatureCategory}
                onChange={(e) => setNewFeatureCategory(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none cursor-pointer"
              >
                {FEATURE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addFeatureMutation.isPending || newFeatureLabel.trim().length < 2}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Feature</span>
              </button>
            </form>

            {featuresLoading ? (
              <p className="text-sm text-slate-500 py-6 text-center">Loading features...</p>
            ) : features.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                No features added yet. Use the form above to highlight suite and building perks.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {features.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 shadow-xs"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{f.label}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                        {f.category}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove feature ${f.label}`}
                      onClick={() => deleteFeatureMutation.mutate(f)}
                      disabled={deleteFeatureMutation.isPending}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CDN Photo Gallery Manager (S3 / MinIO) */}
        {activeTab === 'photos' && (
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <ImagePlus className="w-4 h-4 text-indigo-600" />
                  Upload Photo to CDN (S3 / MinIO)
                </span>
                <span className="text-[11px] text-slate-500">
                  JPEG, PNG, or WebP · Max 5 MB
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-5">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose property photo file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                    }}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>

                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    placeholder="Photo caption (optional)"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCoverUpload}
                      onChange={(e) => setIsCoverUpload(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    Cover
                  </label>

                  <button
                    type="button"
                    disabled={!selectedFile || uploadPhotoMutation.isPending}
                    onClick={() => uploadPhotoMutation.mutate()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload'}</span>
                  </button>
                </div>
              </div>
            </div>

            {photosLoading ? (
              <p className="text-sm text-slate-500 py-6 text-center">Loading CDN photos...</p>
            ) : photos.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                No photos uploaded yet. Upload your first exterior or suite photo above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col"
                  >
                    <div className="relative h-40 bg-slate-100">
                      <img
                        src={photo.cdn_url}
                        alt={photo.caption || property.name}
                        className="w-full h-full object-cover"
                      />
                      {photo.is_cover && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-extrabold shadow-sm">
                          <Star className="w-3 h-3 fill-current" />
                          Cover
                        </span>
                      )}
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {photo.caption || 'Untitled Photo'}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        {!photo.is_cover ? (
                          <button
                            type="button"
                            onClick={() => setCoverMutation.mutate(photo.id)}
                            disabled={setCoverMutation.isPending}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            Set as Cover
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Primary Photo
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setPhotoToDelete(photo)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(photoToDelete)}
        title="Remove CDN Photo?"
        message="This removes the photo from the public property gallery and deletes its object from MinIO / S3 storage."
        confirmLabel="Remove Photo"
        isLoading={deletePhotoMutation.isPending}
        onConfirm={() => {
          if (photoToDelete) deletePhotoMutation.mutate(photoToDelete);
        }}
        onCancel={() => setPhotoToDelete(null)}
      />
    </ModalDialog>
  );
};
