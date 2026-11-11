use std::sync::Arc;

use crate::domain::{
    admin::{PublicPortalRepository, PublicPropertyListing},
    errors::{DomainError, DomainResult},
};
use uuid::Uuid;

pub struct PublicPortalService {
    repo: Arc<dyn PublicPortalRepository>,
}

impl PublicPortalService {
    pub fn new(repo: Arc<dyn PublicPortalRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_public_properties(&self) -> DomainResult<Vec<PublicPropertyListing>> {
        self.repo.list_public_properties().await
    }

    pub async fn get_public_property(&self, id: Uuid) -> DomainResult<PublicPropertyListing> {
        self.repo
            .get_public_property(id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Property listing not found".into()))
    }
}
