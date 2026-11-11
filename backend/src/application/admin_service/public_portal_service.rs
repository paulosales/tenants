use std::sync::Arc;

use crate::domain::{
    admin::{PublicPortalRepository, PublicPropertyListing},
    errors::DomainResult,
};

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
}

