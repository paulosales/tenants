use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use super::dtos::{AddPropertyFeatureRequest, CreatePropertyRequest, UpdatePropertyRequest};
use crate::domain::{
    admin::{
        Property, PropertyFeature, PropertyFeatureRepository, PropertyPhoto,
        PropertyPhotoRepository, PropertyRepository, PropertyWithStats,
    },
    errors::{DomainError, DomainResult},
    ports::{HtmlSanitizerPort, MediaStoragePort},
};
use crate::infrastructure::object_storage::detect_verified_image_format;

const ALLOWED_FEATURE_CATEGORIES: [&str; 5] =
    ["community", "suite", "utilities", "policies", "transit"];

pub struct PropertyService {
    repo: Arc<dyn PropertyRepository>,
    feature_repo: Arc<dyn PropertyFeatureRepository>,
    photo_repo: Arc<dyn PropertyPhotoRepository>,
    html_sanitizer: Arc<dyn HtmlSanitizerPort>,
    media_storage: Arc<dyn MediaStoragePort>,
}

impl PropertyService {
    pub fn new(
        repo: Arc<dyn PropertyRepository>,
        feature_repo: Arc<dyn PropertyFeatureRepository>,
        photo_repo: Arc<dyn PropertyPhotoRepository>,
        html_sanitizer: Arc<dyn HtmlSanitizerPort>,
        media_storage: Arc<dyn MediaStoragePort>,
    ) -> Self {
        Self {
            repo,
            feature_repo,
            photo_repo,
            html_sanitizer,
            media_storage,
        }
    }

    fn validate_coordinates(
        lat: Option<f64>,
        lng: Option<f64>,
    ) -> DomainResult<(Option<f64>, Option<f64>)> {
        match (lat, lng) {
            (Some(la), Some(lo)) => {
                if !la.is_finite() || !(-90.0..=90.0).contains(&la) {
                    return Err(DomainError::ValidationError(
                        "Latitude must be between -90 and 90 degrees".into(),
                    ));
                }
                if !lo.is_finite() || !(-180.0..=180.0).contains(&lo) {
                    return Err(DomainError::ValidationError(
                        "Longitude must be between -180 and 180 degrees".into(),
                    ));
                }
                Ok((Some(la), Some(lo)))
            }
            (None, None) => Ok((None, None)),
            _ => Err(DomainError::ValidationError(
                "Both latitude and longitude must be provided together".into(),
            )),
        }
    }

    pub async fn list_properties(&self) -> DomainResult<Vec<PropertyWithStats>> {
        self.repo.list_properties().await
    }

    pub async fn get_property(&self, id: Uuid) -> DomainResult<Property> {
        self.repo
            .get_property(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Property with ID {} not found", id)))
    }

    pub async fn create_property(&self, req: CreatePropertyRequest) -> DomainResult<Property> {
        if req.name.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "Property name cannot be empty".to_string(),
            ));
        }
        if req.address_line1.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "Address line 1 cannot be empty".to_string(),
            ));
        }
        let (latitude, longitude) = Self::validate_coordinates(req.latitude, req.longitude)?;
        let sanitized_desc = match req.rich_description.as_deref() {
            Some(raw) if !raw.trim().is_empty() => self.html_sanitizer.sanitize(raw)?,
            _ => String::new(),
        };

        let now = Utc::now();
        let prop = Property {
            id: Uuid::new_v4(),
            name: req.name.trim().to_string(),
            address_line1: req.address_line1.trim().to_string(),
            address_line2: req.address_line2.map(|s| s.trim().to_string()),
            city: req.city.trim().to_string(),
            state_province: req.state_province.trim().to_string(),
            postal_code: req.postal_code.trim().to_string(),
            rich_description: sanitized_desc,
            latitude,
            longitude,
            pet_policy: req
                .pet_policy
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
            lease_terms: req
                .lease_terms
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
            features: Vec::new(),
            photos: Vec::new(),
            created_at: now,
            updated_at: now,
        };
        self.repo.create_property(prop).await
    }

    pub async fn update_property(
        &self,
        id: Uuid,
        req: UpdatePropertyRequest,
    ) -> DomainResult<Property> {
        let mut prop = self.get_property(id).await?;
        if req.name.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "Property name cannot be empty".to_string(),
            ));
        }
        let (latitude, longitude) = Self::validate_coordinates(req.latitude, req.longitude)?;
        if let Some(raw_desc) = req.rich_description {
            prop.rich_description = self.html_sanitizer.sanitize(&raw_desc)?;
        }
        if let Some(pet) = req.pet_policy {
            let trimmed = pet.trim().to_string();
            prop.pet_policy = if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            };
        }
        if let Some(terms) = req.lease_terms {
            let trimmed = terms.trim().to_string();
            prop.lease_terms = if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            };
        }
        if req.latitude.is_some() || req.longitude.is_some() {
            prop.latitude = latitude;
            prop.longitude = longitude;
        }
        prop.name = req.name.trim().to_string();
        prop.address_line1 = req.address_line1.trim().to_string();
        prop.address_line2 = req.address_line2.map(|s| s.trim().to_string());
        prop.city = req.city.trim().to_string();
        prop.state_province = req.state_province.trim().to_string();
        prop.postal_code = req.postal_code.trim().to_string();
        prop.updated_at = Utc::now();
        self.repo.update_property(prop).await
    }

    pub async fn delete_property(&self, id: Uuid) -> DomainResult<()> {
        let _ = self.get_property(id).await?;
        let unit_count = self.repo.count_property_units(id).await?;
        if unit_count > 0 {
            return Err(DomainError::Conflict(format!(
                "Cannot delete property that still contains {} unit(s). Please delete or reassign all units first.",
                unit_count
            )));
        }
        self.repo.delete_property(id).await
    }

    // --- Property Features ---

    pub async fn list_features(&self, property_id: Uuid) -> DomainResult<Vec<PropertyFeature>> {
        let _ = self.get_property(property_id).await?;
        self.feature_repo.list_features(property_id).await
    }

    pub async fn add_feature(
        &self,
        property_id: Uuid,
        req: AddPropertyFeatureRequest,
    ) -> DomainResult<PropertyFeature> {
        let _ = self.get_property(property_id).await?;
        let label = req.label.trim().to_string();
        if label.len() < 2 || label.len() > 120 {
            return Err(DomainError::ValidationError(
                "Feature label must be between 2 and 120 characters".into(),
            ));
        }

        let category = req
            .category
            .unwrap_or_else(|| "community".to_string())
            .trim()
            .to_lowercase();
        if !ALLOWED_FEATURE_CATEGORIES.contains(&category.as_str()) {
            return Err(DomainError::ValidationError(
                "Category must be one of: community, suite, utilities, policies, transit".into(),
            ));
        }

        let feature = PropertyFeature {
            id: Uuid::new_v4(),
            property_id,
            label,
            category,
            display_order: req.display_order.unwrap_or(0),
            created_at: Utc::now(),
        };
        self.feature_repo.add_feature(feature).await
    }

    pub async fn delete_feature(&self, property_id: Uuid, feature_id: Uuid) -> DomainResult<()> {
        let _ = self.get_property(property_id).await?;
        self.feature_repo
            .delete_feature(property_id, feature_id)
            .await
    }

    // --- Property Photos (S3 / MinIO CDN) ---

    pub async fn list_photos(&self, property_id: Uuid) -> DomainResult<Vec<PropertyPhoto>> {
        let _ = self.get_property(property_id).await?;
        self.photo_repo.list_photos(property_id).await
    }

    pub async fn upload_photo(
        &self,
        property_id: Uuid,
        declared_content_type: &str,
        bytes: &[u8],
        caption: Option<String>,
        is_cover: bool,
    ) -> DomainResult<PropertyPhoto> {
        let _ = self.get_property(property_id).await?;
        let format = detect_verified_image_format(declared_content_type, bytes)?;

        let photo_id = Uuid::new_v4();
        let storage_key = format!(
            "properties/{}/{}.{}",
            property_id, photo_id, format.extension
        );
        let cdn_url = self
            .media_storage
            .upload_object(&storage_key, format.content_type, bytes)
            .await?;

        let existing_photos = self.photo_repo.list_photos(property_id).await?;
        let effective_cover = is_cover || existing_photos.is_empty();
        let clean_caption = caption
            .map(|c| c.trim().chars().take(255).collect::<String>())
            .filter(|c| !c.is_empty());

        let photo = PropertyPhoto {
            id: photo_id,
            property_id,
            storage_key: storage_key.clone(),
            cdn_url,
            caption: clean_caption,
            is_cover: effective_cover,
            display_order: (existing_photos.len() as i32) + 1,
            created_at: Utc::now(),
        };

        match self.photo_repo.add_photo(photo).await {
            Ok(saved) => Ok(saved),
            Err(err) => {
                let _ = self.media_storage.delete_object(&storage_key).await;
                Err(err)
            }
        }
    }

    pub async fn set_cover_photo(
        &self,
        property_id: Uuid,
        photo_id: Uuid,
    ) -> DomainResult<PropertyPhoto> {
        let _ = self.get_property(property_id).await?;
        self.photo_repo.set_cover_photo(property_id, photo_id).await
    }

    pub async fn delete_photo(&self, property_id: Uuid, photo_id: Uuid) -> DomainResult<()> {
        let _ = self.get_property(property_id).await?;
        let existing = self
            .photo_repo
            .get_photo(property_id, photo_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Property photo not found".into()))?;

        self.photo_repo.delete_photo(property_id, photo_id).await?;
        let _ = self
            .media_storage
            .delete_object(&existing.storage_key)
            .await;
        Ok(())
    }
}
