use std::sync::Arc;
use uuid::Uuid;

pub mod amenity_service;
pub mod application_service;
pub mod dtos;
pub mod maintenance_service;
pub mod message_service;
pub mod parking_layout_service;
pub mod property_service;
pub mod public_portal_service;
pub mod staff_service;
pub mod tenant_reservation_service;
pub mod tenant_service;
pub mod unit_service;
pub mod user_admin_service;

pub use amenity_service::AdminAmenityService;
pub use application_service::{PublicApplicationReceipt, TenancyApplicationService};
pub use dtos::*;
pub use maintenance_service::MaintenanceService;
pub use message_service::StaffMessagingService;
pub use parking_layout_service::ParkingLayoutService;
pub use property_service::PropertyService;
pub use public_portal_service::PublicPortalService;
pub use staff_service::PropertyStaffService;
pub use tenant_reservation_service::TenantReservationService;
pub use tenant_service::TenantService;
pub use unit_service::UnitService;
pub use user_admin_service::AdminUserService;

use crate::{
    domain::{
        admin::*,
        errors::DomainResult,
        ports::PasswordHasher,
        user::{Role, User},
    },
    infrastructure::security::Argon2PasswordHasher,
};

/// Facade composing single-responsibility domain services over segregated repository traits (ISP + SRP).
pub struct AdminService {
    pub properties: PropertyService,
    pub units: UnitService,
    pub tenants: TenantService,
    pub amenities: AdminAmenityService,
    pub parking_layouts: ParkingLayoutService,
    pub maintenance: MaintenanceService,
    pub reservations: TenantReservationService,
    pub staff: PropertyStaffService,
    pub public_portal: PublicPortalService,
    pub applications: TenancyApplicationService,
    pub messages: StaffMessagingService,
    pub users: AdminUserService,
}

impl AdminService {
    pub fn new(repo: Arc<dyn AdminRepository>) -> Self {
        Self::with_password_hasher(repo, Arc::new(Argon2PasswordHasher))
    }

    pub fn with_password_hasher(
        repo: Arc<dyn AdminRepository>,
        password_hasher: Arc<dyn PasswordHasher>,
    ) -> Self {
        let property_repo: Arc<dyn PropertyRepository> = repo.clone();
        let unit_repo: Arc<dyn UnitRepository> = repo.clone();
        let tenant_repo: Arc<dyn TenantRepository> = repo.clone();
        let amenity_repo: Arc<dyn AdminAmenityRepository> = repo.clone();
        let parking_layout_repo: Arc<dyn ParkingLayoutRepository> = repo.clone();
        let maintenance_repo: Arc<dyn MaintenanceCallRepository> = repo.clone();
        let reservation_repo: Arc<dyn TenantReservationRepository> = repo.clone();
        let staff_repo: Arc<dyn PropertyStaffRepository> = repo.clone();
        let portal_repo: Arc<dyn PublicPortalRepository> = repo.clone();
        let app_repo: Arc<dyn TenancyApplicationRepository> = repo.clone();
        let message_repo: Arc<dyn StaffMessageRepository> = repo.clone();
        let admin_user_repo: Arc<dyn AdminUserRepository> = repo;

        Self {
            properties: PropertyService::new(property_repo.clone()),
            units: UnitService::new(unit_repo.clone(), property_repo.clone()),
            tenants: TenantService::new(tenant_repo.clone(), unit_repo.clone()),
            amenities: AdminAmenityService::new(amenity_repo, property_repo.clone()),
            parking_layouts: ParkingLayoutService::new(parking_layout_repo, property_repo.clone()),
            maintenance: MaintenanceService::new(maintenance_repo),
            reservations: TenantReservationService::new(reservation_repo),
            staff: PropertyStaffService::new(staff_repo),
            public_portal: PublicPortalService::new(portal_repo.clone()),
            applications: TenancyApplicationService::new(
                app_repo,
                property_repo.clone(),
                portal_repo,
                tenant_repo,
                unit_repo,
            ),
            messages: StaffMessagingService::new(message_repo, property_repo.clone()),
            users: AdminUserService::new(admin_user_repo, property_repo, password_hasher),
        }
    }

    // Properties
    pub async fn list_properties(&self) -> DomainResult<Vec<PropertyWithStats>> {
        self.properties.list_properties().await
    }
    pub async fn get_property(&self, id: Uuid) -> DomainResult<Property> {
        self.properties.get_property(id).await
    }
    pub async fn create_property(&self, req: CreatePropertyRequest) -> DomainResult<Property> {
        self.properties.create_property(req).await
    }
    pub async fn update_property(&self, id: Uuid, req: UpdatePropertyRequest) -> DomainResult<Property> {
        self.properties.update_property(id, req).await
    }
    pub async fn delete_property(&self, id: Uuid) -> DomainResult<()> {
        self.properties.delete_property(id).await
    }

    // Units
    pub async fn list_units_by_property(&self, property_id: Uuid) -> DomainResult<Vec<UnitWithTenant>> {
        self.units.list_units_by_property(property_id).await
    }
    pub async fn get_unit(&self, id: Uuid) -> DomainResult<Unit> {
        self.units.get_unit(id).await
    }
    pub async fn create_unit(&self, property_id: Uuid, req: CreateUnitRequest) -> DomainResult<Unit> {
        self.units.create_unit(property_id, req).await
    }
    pub async fn update_unit(&self, id: Uuid, req: UpdateUnitRequest) -> DomainResult<Unit> {
        self.units.update_unit(id, req).await
    }
    pub async fn delete_unit(&self, id: Uuid) -> DomainResult<()> {
        self.units.delete_unit(id).await
    }

    // Tenants
    pub async fn list_tenants(
        &self,
        property_id: Option<Uuid>,
        status: Option<TenantStatus>,
        query: Option<String>,
    ) -> DomainResult<Vec<TenantWithUnit>> {
        self.tenants.list_tenants(property_id, status, query).await
    }
    pub async fn get_tenant(&self, id: Uuid) -> DomainResult<TenantWithUnit> {
        self.tenants.get_tenant(id).await
    }
    pub async fn create_tenant(&self, req: CreateTenantRequest) -> DomainResult<Tenant> {
        self.tenants.create_tenant(req).await
    }
    pub async fn update_tenant(&self, id: Uuid, req: UpdateTenantRequest) -> DomainResult<Tenant> {
        self.tenants.update_tenant(id, req).await
    }
    pub async fn delete_tenant(&self, id: Uuid) -> DomainResult<()> {
        self.tenants.delete_tenant(id).await
    }

    // Amenities
    pub async fn list_amenities_by_property(&self, property_id: Uuid) -> DomainResult<Vec<AdminAmenity>> {
        self.amenities.list_amenities_by_property(property_id).await
    }
    pub async fn get_amenity(&self, id: Uuid) -> DomainResult<AdminAmenity> {
        self.amenities.get_amenity(id).await
    }
    pub async fn create_amenity(&self, property_id: Uuid, req: CreateAmenityRequest) -> DomainResult<AdminAmenity> {
        self.amenities.create_amenity(property_id, req).await
    }
    pub async fn update_amenity(&self, id: Uuid, req: UpdateAmenityRequest) -> DomainResult<AdminAmenity> {
        self.amenities.update_amenity(id, req).await
    }
    pub async fn delete_amenity(&self, id: Uuid) -> DomainResult<()> {
        self.amenities.delete_amenity(id).await
    }

    // Parking Layouts
    pub async fn get_parking_layout(&self, property_id: Uuid) -> DomainResult<ParkingLayoutWithSpots> {
        self.parking_layouts.get_parking_layout(property_id).await
    }
    pub async fn save_parking_layout(
        &self,
        property_id: Uuid,
        req: SaveParkingLayoutRequest,
    ) -> DomainResult<ParkingLayoutWithSpots> {
        self.parking_layouts.save_parking_layout(property_id, req).await
    }

    // Maintenance Calls
    pub async fn list_maintenance_calls(
        &self,
        tenant_id: Option<Uuid>,
        property_id: Option<Uuid>,
        status: Option<String>,
    ) -> DomainResult<Vec<MaintenanceCall>> {
        self.maintenance.list_maintenance_calls(tenant_id, property_id, status).await
    }
    pub async fn get_maintenance_call(&self, id: Uuid) -> DomainResult<MaintenanceCall> {
        self.maintenance.get_maintenance_call(id).await
    }
    pub async fn create_maintenance_call(&self, req: CreateMaintenanceCallRequest) -> DomainResult<MaintenanceCall> {
        self.maintenance.create_maintenance_call(req).await
    }
    pub async fn update_maintenance_call_status(
        &self,
        id: Uuid,
        req: UpdateMaintenanceCallStatusRequest,
    ) -> DomainResult<MaintenanceCall> {
        self.maintenance.update_maintenance_call_status(id, req).await
    }
    pub async fn cancel_maintenance_call(&self, id: Uuid) -> DomainResult<()> {
        self.maintenance.cancel_maintenance_call(id).await
    }
    pub async fn assign_maintenance_call_staff(
        &self,
        call_id: Uuid,
        req: AssignMaintenanceCallStaffRequest,
    ) -> DomainResult<MaintenanceCall> {
        self.maintenance.assign_maintenance_call_staff(call_id, req).await
    }

    // Tenant Reservations
    pub async fn list_tenant_reservations(&self, tenant_id: Option<Uuid>) -> DomainResult<Vec<TenantReservation>> {
        self.reservations.list_tenant_reservations(tenant_id).await
    }
    pub async fn create_tenant_reservation(&self, req: CreateTenantReservationRequest) -> DomainResult<TenantReservation> {
        self.reservations.create_tenant_reservation(req).await
    }
    pub async fn cancel_tenant_reservation(&self, id: Uuid) -> DomainResult<()> {
        self.reservations.cancel_tenant_reservation(id).await
    }

    // Property Staff
    pub async fn list_property_staff(
        &self,
        property_id: Option<Uuid>,
        role: Option<String>,
    ) -> DomainResult<Vec<PropertyStaff>> {
        self.staff.list_property_staff(property_id, role).await
    }
    pub async fn get_property_staff(&self, id: Uuid) -> DomainResult<PropertyStaff> {
        self.staff.get_property_staff(id).await
    }
    pub async fn create_property_staff(&self, req: CreatePropertyStaffRequest) -> DomainResult<PropertyStaff> {
        self.staff.create_property_staff(req).await
    }
    pub async fn update_property_staff(
        &self,
        id: Uuid,
        req: UpdatePropertyStaffRequest,
    ) -> DomainResult<PropertyStaff> {
        self.staff.update_property_staff(id, req).await
    }
    pub async fn delete_property_staff(&self, id: Uuid) -> DomainResult<()> {
        self.staff.delete_property_staff(id).await
    }

    // Parking Spot Assignment & Public Portal & Applications & Messaging
    pub async fn assign_parking_spot(
        &self,
        spot_id: Uuid,
        req: AssignParkingSpotRequest,
    ) -> DomainResult<ParkingSpot> {
        self.parking_layouts.assign_parking_spot(spot_id, req).await
    }
    pub async fn review_tenant_reservation(
        &self,
        id: Uuid,
        req: ReviewTenantReservationRequest,
    ) -> DomainResult<TenantReservation> {
        self.reservations.review_tenant_reservation(id, req).await
    }
    pub async fn list_public_properties(&self) -> DomainResult<Vec<PublicPropertyListing>> {
        self.public_portal.list_public_properties().await
    }
    pub async fn submit_public_application(
        &self,
        req: CreateTenancyApplicationRequest,
    ) -> DomainResult<PublicApplicationReceipt> {
        self.applications.submit_public_application(req).await
    }
    pub async fn list_applications(
        &self,
        property_id: Option<Uuid>,
        status: Option<String>,
    ) -> DomainResult<Vec<TenancyApplication>> {
        self.applications.list_applications(property_id, status).await
    }
    pub async fn review_application(
        &self,
        id: Uuid,
        reviewer_user_id: Uuid,
        req: ReviewTenancyApplicationRequest,
    ) -> DomainResult<TenancyApplication> {
        self.applications
            .review_application(id, reviewer_user_id, req)
            .await
    }
    pub async fn list_messages(
        &self,
        property_id: Uuid,
        staff_id: Option<Uuid>,
    ) -> DomainResult<Vec<StaffMessage>> {
        self.messages.list_messages(property_id, staff_id).await
    }
    pub async fn send_message(
        &self,
        sender: &User,
        req: CreateStaffMessageRequest,
    ) -> DomainResult<StaffMessage> {
        self.messages.send_message(sender, req).await
    }
    pub async fn mark_message_read(&self, id: Uuid) -> DomainResult<StaffMessage> {
        self.messages.mark_read(id).await
    }

    // Users & Roles Administration
    pub async fn list_admin_users(
        &self,
        role: Option<Role>,
        property_id: Option<Uuid>,
        search: Option<String>,
    ) -> DomainResult<Vec<ManagedUser>> {
        self.users.list_users(role, property_id, search).await
    }
    pub async fn get_admin_user(&self, id: Uuid) -> DomainResult<ManagedUser> {
        self.users.get_user(id).await
    }
    pub async fn create_admin_user(&self, req: CreateAdminUserRequest) -> DomainResult<ManagedUser> {
        self.users.create_user(req).await
    }
    pub async fn update_admin_user(
        &self,
        actor_user_id: Uuid,
        id: Uuid,
        req: UpdateAdminUserRequest,
    ) -> DomainResult<ManagedUser> {
        self.users.update_user(actor_user_id, id, req).await
    }
    pub async fn delete_admin_user(&self, actor_user_id: Uuid, id: Uuid) -> DomainResult<()> {
        self.users.delete_user(actor_user_id, id).await
    }
    pub async fn list_roles(&self) -> DomainResult<Vec<RoleDefinition>> {
        self.users.list_roles().await
    }
}

