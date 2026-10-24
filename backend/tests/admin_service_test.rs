use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;

use backend::{
    application::{
        admin_service::*,
    },
    domain::admin::*,
    infrastructure::repositories::PostgresAdminRepository,
};

async fn setup_admin_service() -> (AdminService, Uuid) {
    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://postgres:postgres_dev_secret_change_in_prod@localhost:5432/tenants_db".to_string()
    });
    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test Postgres database");

    let repo = Arc::new(PostgresAdminRepository::new(pool));
    let service = AdminService::new(repo);

    // Create a dedicated test property
    let prop = service
        .create_property(CreatePropertyRequest {
            name: format!("Test Property {}", Uuid::new_v4()),
            address_line1: "100 Test St".to_string(),
            address_line2: None,
            city: "Seattle".to_string(),
            state_province: "WA".to_string(),
            postal_code: "98101".to_string(),
        })
        .await
        .expect("Failed to create test property");

    (service, prop.id)
}

#[tokio::test]
async fn test_property_crud_and_dependency_guard() {
    let (service, property_id) = setup_admin_service().await;

    // 1. Get property
    let prop = service.get_property(property_id).await.expect("Failed to get property");
    assert!(prop.name.starts_with("Test Property"));

    // 2. Add a unit to this property
    let unit = service
        .create_unit(
            property_id,
            CreateUnitRequest {
                unit_number: "U-101".to_string(),
                floor: 1,
                bedrooms: 2,
                bathrooms: 2.0,
                square_feet: 850,
                status: Some(UnitStatus::Vacant),
            },
        )
        .await
        .expect("Failed to create unit");

    // 3. Attempting to delete property while unit exists MUST fail with Conflict
    let delete_err = service.delete_property(property_id).await;
    assert!(delete_err.is_err(), "Expected delete_property to fail due to existing units");

    // 4. Delete the unit first
    service.delete_unit(unit.id).await.expect("Failed to delete unit");

    // 5. Now delete property succeeds
    service.delete_property(property_id).await.expect("Expected delete_property to succeed after units are deleted");
}

#[tokio::test]
async fn test_tenant_assignment_and_unit_status_transitions() {
    let (service, property_id) = setup_admin_service().await;

    // 1. Create a vacant unit
    let unit = service
        .create_unit(
            property_id,
            CreateUnitRequest {
                unit_number: format!("T-{}", &Uuid::new_v4().to_string()[..4]),
                floor: 2,
                bedrooms: 1,
                bathrooms: 1.0,
                square_feet: 600,
                status: Some(UnitStatus::Vacant),
            },
        )
        .await
        .expect("Failed to create unit");

    assert_eq!(unit.status, UnitStatus::Vacant);

    // 2. Create tenant assigned to this unit
    let tenant_email = format!("tenant-{}@example.com", Uuid::new_v4());
    let tenant = service
        .create_tenant(CreateTenantRequest {
            first_name: "Jane".to_string(),
            last_name: "Doe".to_string(),
            email: tenant_email.clone(),
            phone: "+1 555-0100".to_string(),
            emergency_contact_name: None,
            emergency_contact_phone: None,
            assigned_unit_id: Some(unit.id),
            lease_start_date: None,
            lease_end_date: None,
            status: Some(TenantStatus::Active),
        })
        .await
        .expect("Failed to create tenant");

    // 3. Verify unit status transitioned to occupied
    let updated_unit = service.get_unit(unit.id).await.expect("Failed to fetch unit");
    assert_eq!(updated_unit.status, UnitStatus::Occupied);

    // 4. Delete tenant should release unit back to vacant
    service.delete_tenant(tenant.id).await.expect("Failed to delete tenant");
    let released_unit = service.get_unit(unit.id).await.expect("Failed to fetch unit");
    assert_eq!(released_unit.status, UnitStatus::Vacant);

    // Clean up
    let _ = service.delete_unit(unit.id).await;
    let _ = service.delete_property(property_id).await;
}

#[tokio::test]
async fn test_parking_layout_atomic_bulk_upsert() {
    let (service, property_id) = setup_admin_service().await;

    // 1. Bulk save layout with 3 spots
    let spots = vec![
        SaveParkingSpotDto {
            id: None,
            spot_label: "A-01".to_string(),
            x: 40.0,
            y: 40.0,
            width: 60.0,
            height: 120.0,
            rotation: 0.0,
            spot_type: SpotType::Standard,
            is_occupied: false,
            assigned_tenant_id: None,
        },
        SaveParkingSpotDto {
            id: None,
            spot_label: "A-02".to_string(),
            x: 120.0,
            y: 40.0,
            width: 60.0,
            height: 120.0,
            rotation: 0.0,
            spot_type: SpotType::EvCharging,
            is_occupied: true,
            assigned_tenant_id: None,
        },
    ];

    let layout_res = service
        .save_parking_layout(
            property_id,
            SaveParkingLayoutRequest {
                canvas_width: 1400,
                canvas_height: 900,
                grid_size: 20,
                spots,
            },
        )
        .await
        .expect("Failed to bulk save parking layout");

    assert_eq!(layout_res.layout.canvas_width, 1400);
    assert_eq!(layout_res.layout.canvas_height, 900);
    assert_eq!(layout_res.spots.len(), 2);

    // 2. Query layout
    let fetched = service.get_parking_layout(property_id).await.expect("Failed to get parking layout");
    assert_eq!(fetched.layout.canvas_width, 1400);
    assert_eq!(fetched.spots.len(), 2);
    assert_eq!(fetched.spots[0].spot_label, "A-01");
    assert_eq!(fetched.spots[1].spot_type, SpotType::EvCharging);

    // Clean up
    let _ = service.delete_property(property_id).await;
}
