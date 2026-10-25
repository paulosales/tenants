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
                tenant_ids: None,
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
                tenant_ids: None,
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

#[tokio::test]
async fn test_assign_single_unit_to_multiple_tenants() {
    let (service, property_id) = setup_admin_service().await;

    // 1. Create two tenants
    let email_a = format!("tenant-a-{}@example.com", Uuid::new_v4());
    let email_b = format!("tenant-b-{}@example.com", Uuid::new_v4());
    let email_c = format!("tenant-c-{}@example.com", Uuid::new_v4());

    let tenant_a = service
        .create_tenant(CreateTenantRequest {
            first_name: "Alice".to_string(),
            last_name: "Smith".to_string(),
            email: email_a.clone(),
            phone: "+1 555-0101".to_string(),
            emergency_contact_name: None,
            emergency_contact_phone: None,
            assigned_unit_id: None,
            lease_start_date: None,
            lease_end_date: None,
            status: Some(TenantStatus::Active),
        })
        .await
        .expect("Failed to create tenant A");

    let tenant_b = service
        .create_tenant(CreateTenantRequest {
            first_name: "Bob".to_string(),
            last_name: "Jones".to_string(),
            email: email_b.clone(),
            phone: "+1 555-0102".to_string(),
            emergency_contact_name: None,
            emergency_contact_phone: None,
            assigned_unit_id: None,
            lease_start_date: None,
            lease_end_date: None,
            status: Some(TenantStatus::Active),
        })
        .await
        .expect("Failed to create tenant B");

    let tenant_c = service
        .create_tenant(CreateTenantRequest {
            first_name: "Charlie".to_string(),
            last_name: "Brown".to_string(),
            email: email_c.clone(),
            phone: "+1 555-0103".to_string(),
            emergency_contact_name: None,
            emergency_contact_phone: None,
            assigned_unit_id: None,
            lease_start_date: None,
            lease_end_date: None,
            status: Some(TenantStatus::Active),
        })
        .await
        .expect("Failed to create tenant C");

    // 2. Create a unit assigning both Alice (A) and Bob (B) simultaneously
    let unit = service
        .create_unit(
            property_id,
            CreateUnitRequest {
                unit_number: format!("MULTI-{}", &Uuid::new_v4().to_string()[..4]),
                floor: 3,
                bedrooms: 2,
                bathrooms: 2.0,
                square_feet: 900,
                status: None, // should default to Occupied because tenants are assigned
                tenant_ids: Some(vec![tenant_a.id, tenant_b.id]),
            },
        )
        .await
        .expect("Failed to create unit with multiple tenants");

    // 3. Verify unit status transitioned to Occupied
    assert_eq!(unit.status, UnitStatus::Occupied);

    // 4. Query list_units_by_property and check that both tenants are attached
    let units = service
        .list_units_by_property(property_id)
        .await
        .expect("Failed to list units");

    let created_unit_opt = units.iter().find(|u| u.id == unit.id);
    assert!(created_unit_opt.is_some(), "Unit should be in list");
    let created_unit = created_unit_opt.unwrap();

    assert_eq!(created_unit.tenants.len(), 2, "Unit should have 2 assigned tenants");
    let tenant_ids_in_unit: Vec<Uuid> = created_unit.tenants.iter().map(|t| t.id).collect();
    assert!(tenant_ids_in_unit.contains(&tenant_a.id));
    assert!(tenant_ids_in_unit.contains(&tenant_b.id));

    // 5. Update unit: replace Alice with Charlie (Bob and Charlie now assigned)
    service
        .update_unit(
            unit.id,
            UpdateUnitRequest {
                unit_number: created_unit.unit_number.clone(),
                floor: created_unit.floor,
                bedrooms: created_unit.bedrooms,
                bathrooms: created_unit.bathrooms,
                square_feet: created_unit.square_feet,
                status: UnitStatus::Occupied,
                tenant_ids: Some(vec![tenant_b.id, tenant_c.id]),
            },
        )
        .await
        .expect("Failed to update unit tenants");

    // Check Alice is unassigned
    let refreshed_a = service.get_tenant(tenant_a.id).await.expect("Failed to get tenant A");
    assert_eq!(refreshed_a.assigned_unit_id, None, "Alice should now be unassigned");

    // Check Charlie is assigned
    let refreshed_c = service.get_tenant(tenant_c.id).await.expect("Failed to get tenant C");
    assert_eq!(refreshed_c.assigned_unit_id, Some(unit.id), "Charlie should now be assigned to unit");

    // 6. Update unit to have empty tenants -> status should become Vacant
    service
        .update_unit(
            unit.id,
            UpdateUnitRequest {
                unit_number: created_unit.unit_number.clone(),
                floor: created_unit.floor,
                bedrooms: created_unit.bedrooms,
                bathrooms: created_unit.bathrooms,
                square_feet: created_unit.square_feet,
                status: UnitStatus::Occupied, // was occupied
                tenant_ids: Some(vec![]),
            },
        )
        .await
        .expect("Failed to clear tenants");

    let vacant_unit = service.get_unit(unit.id).await.expect("Failed to get unit");
    assert_eq!(vacant_unit.status, UnitStatus::Vacant, "Unit should now be Vacant");

    // Clean up
    let _ = service.delete_unit(unit.id).await;
    let _ = service.delete_tenant(tenant_a.id).await;
    let _ = service.delete_tenant(tenant_b.id).await;
    let _ = service.delete_tenant(tenant_c.id).await;
    let _ = service.delete_property(property_id).await;
}

