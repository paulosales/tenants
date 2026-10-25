use async_trait::async_trait;
use chrono::Utc;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::domain::{
    admin::*,
    errors::{DomainError, DomainResult},
};

pub struct PostgresAdminRepository {
    pool: PgPool,
}

impl PostgresAdminRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AdminRepository for PostgresAdminRepository {
    // ------------------------------------------
    // Properties
    // ------------------------------------------
    async fn list_properties(&self) -> DomainResult<Vec<PropertyWithStats>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                p.id, p.name, p.address_line1, p.address_line2, p.city, p.state_province, p.postal_code,
                COALESCE(COUNT(DISTINCT u.id), 0)::int8 as unit_count,
                COALESCE(COUNT(DISTINCT CASE WHEN u.status = 'occupied' THEN u.id END), 0)::int8 as occupied_units_count,
                COALESCE(COUNT(DISTINCT t.id), 0)::int8 as tenant_count,
                p.created_at, p.updated_at
            FROM properties p
            LEFT JOIN units u ON u.property_id = p.id AND u.deleted_at IS NULL
            LEFT JOIN tenants t ON t.assigned_unit_id = u.id AND t.deleted_at IS NULL AND t.status = 'active'
            WHERE p.deleted_at IS NULL
            GROUP BY p.id
            ORDER BY p.name ASC
            "#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list properties: {}", e)))?;

        let properties = rows
            .into_iter()
            .map(|r| PropertyWithStats {
                id: r.get("id"),
                name: r.get("name"),
                address_line1: r.get("address_line1"),
                address_line2: r.get("address_line2"),
                city: r.get("city"),
                state_province: r.get("state_province"),
                postal_code: r.get("postal_code"),
                unit_count: r.get("unit_count"),
                occupied_units_count: r.get("occupied_units_count"),
                tenant_count: r.get("tenant_count"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            })
            .collect();

        Ok(properties)
    }

    async fn get_property(&self, id: Uuid) -> DomainResult<Option<Property>> {
        let row = sqlx::query(
            r#"
            SELECT id, name, address_line1, address_line2, city, state_province, postal_code, created_at, updated_at
            FROM properties
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get property: {}", e)))?;

        Ok(row.map(|r| Property {
            id: r.get("id"),
            name: r.get("name"),
            address_line1: r.get("address_line1"),
            address_line2: r.get("address_line2"),
            city: r.get("city"),
            state_province: r.get("state_province"),
            postal_code: r.get("postal_code"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }))
    }

    async fn create_property(&self, property: Property) -> DomainResult<Property> {
        let row = sqlx::query(
            r#"
            INSERT INTO properties (id, name, address_line1, address_line2, city, state_province, postal_code, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, name, address_line1, address_line2, city, state_province, postal_code, created_at, updated_at
            "#
        )
        .bind(property.id)
        .bind(&property.name)
        .bind(&property.address_line1)
        .bind(&property.address_line2)
        .bind(&property.city)
        .bind(&property.state_province)
        .bind(&property.postal_code)
        .bind(property.created_at)
        .bind(property.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to create property: {}", e)))?;

        Ok(Property {
            id: row.get("id"),
            name: row.get("name"),
            address_line1: row.get("address_line1"),
            address_line2: row.get("address_line2"),
            city: row.get("city"),
            state_province: row.get("state_province"),
            postal_code: row.get("postal_code"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn update_property(&self, property: Property) -> DomainResult<Property> {
        let row = sqlx::query(
            r#"
            UPDATE properties
            SET name = $2, address_line1 = $3, address_line2 = $4, city = $5, state_province = $6, postal_code = $7, updated_at = $8
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, name, address_line1, address_line2, city, state_province, postal_code, created_at, updated_at
            "#
        )
        .bind(property.id)
        .bind(&property.name)
        .bind(&property.address_line1)
        .bind(&property.address_line2)
        .bind(&property.city)
        .bind(&property.state_province)
        .bind(&property.postal_code)
        .bind(property.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update property: {}", e)))?;

        Ok(Property {
            id: row.get("id"),
            name: row.get("name"),
            address_line1: row.get("address_line1"),
            address_line2: row.get("address_line2"),
            city: row.get("city"),
            state_province: row.get("state_province"),
            postal_code: row.get("postal_code"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn delete_property(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("UPDATE properties SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete property: {}", e)))?;
        Ok(())
    }

    async fn count_property_units(&self, property_id: Uuid) -> DomainResult<i64> {
        let row = sqlx::query("SELECT COUNT(*)::int8 as count FROM units WHERE property_id = $1 AND deleted_at IS NULL")
            .bind(property_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to count units: {}", e)))?;
        Ok(row.get("count"))
    }

    // ------------------------------------------
    // Units
    // ------------------------------------------
    async fn list_units_by_property(&self, property_id: Uuid) -> DomainResult<Vec<UnitWithTenant>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                u.id, u.property_id, u.unit_number, u.floor, u.bedrooms, u.bathrooms::float8 as bathrooms, u.square_feet, u.status,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', t.id,
                            'name', t.first_name || ' ' || t.last_name,
                            'email', t.email,
                            'phone', t.phone
                        )
                        ORDER BY t.first_name ASC, t.last_name ASC
                    ) FILTER (WHERE t.id IS NOT NULL),
                    '[]'::json
                ) as tenants_json,
                u.created_at, u.updated_at
            FROM units u
            LEFT JOIN tenants t ON t.assigned_unit_id = u.id AND t.deleted_at IS NULL AND t.status = 'active'
            WHERE u.property_id = $1 AND u.deleted_at IS NULL
            GROUP BY u.id
            ORDER BY u.unit_number ASC
            "#
        )
        .bind(property_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list units: {}", e)))?;

        let units = rows
            .into_iter()
            .map(|r| {
                let status_str: String = r.get("status");
                let tenants_val: serde_json::Value = r.get("tenants_json");
                let tenants: Vec<UnitTenantSummary> = serde_json::from_value(tenants_val).unwrap_or_default();
                let tenant_id = tenants.first().map(|t| t.id);
                let tenant_email = tenants.first().map(|t| t.email.clone());
                let tenant_name = if tenants.is_empty() {
                    None
                } else {
                    Some(tenants.iter().map(|t| t.name.as_str()).collect::<Vec<_>>().join(", "))
                };

                UnitWithTenant {
                    id: r.get("id"),
                    property_id: r.get("property_id"),
                    unit_number: r.get("unit_number"),
                    floor: r.get("floor"),
                    bedrooms: r.get("bedrooms"),
                    bathrooms: r.get("bathrooms"),
                    square_feet: r.get("square_feet"),
                    status: UnitStatus::from_str(&status_str),
                    tenant_id,
                    tenant_name,
                    tenant_email,
                    tenants,
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }
            })
            .collect();

        Ok(units)
    }

    async fn get_unit(&self, id: Uuid) -> DomainResult<Option<Unit>> {
        let row = sqlx::query(
            r#"
            SELECT id, property_id, unit_number, floor, bedrooms, bathrooms::float8 as bathrooms, square_feet, status, created_at, updated_at
            FROM units
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get unit: {}", e)))?;

        Ok(row.map(|r| {
            let status_str: String = r.get("status");
            Unit {
                id: r.get("id"),
                property_id: r.get("property_id"),
                unit_number: r.get("unit_number"),
                floor: r.get("floor"),
                bedrooms: r.get("bedrooms"),
                bathrooms: r.get("bathrooms"),
                square_feet: r.get("square_feet"),
                status: UnitStatus::from_str(&status_str),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            }
        }))
    }

    async fn create_unit(&self, unit: Unit) -> DomainResult<Unit> {
        let row = sqlx::query(
            r#"
            INSERT INTO units (id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, property_id, unit_number, floor, bedrooms, bathrooms::float8 as bathrooms, square_feet, status, created_at, updated_at
            "#
        )
        .bind(unit.id)
        .bind(unit.property_id)
        .bind(&unit.unit_number)
        .bind(unit.floor)
        .bind(unit.bedrooms)
        .bind(unit.bathrooms)
        .bind(unit.square_feet)
        .bind(unit.status.as_str())
        .bind(unit.created_at)
        .bind(unit.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    return DomainError::Conflict(format!(
                        "Unit '{}' already exists in this property",
                        unit.unit_number
                    ));
                }
            }
            DomainError::Internal(format!("Failed to create unit: {}", e))
        })?;

        let status_str: String = row.get("status");
        Ok(Unit {
            id: row.get("id"),
            property_id: row.get("property_id"),
            unit_number: row.get("unit_number"),
            floor: row.get("floor"),
            bedrooms: row.get("bedrooms"),
            bathrooms: row.get("bathrooms"),
            square_feet: row.get("square_feet"),
            status: UnitStatus::from_str(&status_str),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn update_unit(&self, unit: Unit) -> DomainResult<Unit> {
        let row = sqlx::query(
            r#"
            UPDATE units
            SET unit_number = $2, floor = $3, bedrooms = $4, bathrooms = $5, square_feet = $6, status = $7, updated_at = $8
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, property_id, unit_number, floor, bedrooms, bathrooms::float8 as bathrooms, square_feet, status, created_at, updated_at
            "#
        )
        .bind(unit.id)
        .bind(&unit.unit_number)
        .bind(unit.floor)
        .bind(unit.bedrooms)
        .bind(unit.bathrooms)
        .bind(unit.square_feet)
        .bind(unit.status.as_str())
        .bind(unit.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update unit: {}", e)))?;

        let status_str: String = row.get("status");
        Ok(Unit {
            id: row.get("id"),
            property_id: row.get("property_id"),
            unit_number: row.get("unit_number"),
            floor: row.get("floor"),
            bedrooms: row.get("bedrooms"),
            bathrooms: row.get("bathrooms"),
            square_feet: row.get("square_feet"),
            status: UnitStatus::from_str(&status_str),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn delete_unit(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("UPDATE tenants SET assigned_unit_id = NULL, updated_at = NOW() WHERE assigned_unit_id = $1 AND deleted_at IS NULL")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to unassign tenants on unit deletion: {}", e)))?;

        sqlx::query("UPDATE units SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete unit: {}", e)))?;
        Ok(())
    }

    async fn set_unit_status(&self, unit_id: Uuid, status: UnitStatus) -> DomainResult<()> {
        sqlx::query("UPDATE units SET status = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL")
            .bind(unit_id)
            .bind(status.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to update unit status: {}", e)))?;
        Ok(())
    }

    async fn sync_unit_tenants(&self, unit_id: Uuid, tenant_ids: &[Uuid]) -> DomainResult<()> {
        if tenant_ids.is_empty() {
            sqlx::query(
                "UPDATE tenants SET assigned_unit_id = NULL, updated_at = NOW() WHERE assigned_unit_id = $1 AND deleted_at IS NULL"
            )
            .bind(unit_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to unassign tenants: {}", e)))?;
        } else {
            // 1. Unassign any tenant currently assigned to this unit that is not in the new list
            sqlx::query(
                "UPDATE tenants SET assigned_unit_id = NULL, updated_at = NOW() WHERE assigned_unit_id = $1 AND NOT (id = ANY($2)) AND deleted_at IS NULL"
            )
            .bind(unit_id)
            .bind(tenant_ids)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to unassign removed tenants: {}", e)))?;

            // 2. Assign the specified tenants to this unit
            sqlx::query(
                "UPDATE tenants SET assigned_unit_id = $1, updated_at = NOW() WHERE id = ANY($2) AND deleted_at IS NULL"
            )
            .bind(unit_id)
            .bind(tenant_ids)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to assign tenants to unit: {}", e)))?;
        }
        Ok(())
    }

    async fn count_active_tenants_for_unit(&self, unit_id: Uuid, exclude_tenant_id: Option<Uuid>) -> DomainResult<i64> {
        let row = sqlx::query(
            "SELECT COUNT(*)::int8 as count FROM tenants WHERE assigned_unit_id = $1 AND ($2::uuid IS NULL OR id != $2) AND deleted_at IS NULL AND status = 'active'"
        )
        .bind(unit_id)
        .bind(exclude_tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to count active tenants: {}", e)))?;

        let count: i64 = row.get("count");
        Ok(count)
    }

    // ------------------------------------------
    // Tenants
    // ------------------------------------------
    async fn list_tenants(
        &self,
        property_id: Option<Uuid>,
        status: Option<TenantStatus>,
        query: Option<String>,
    ) -> DomainResult<Vec<TenantWithUnit>> {
        let status_str = status.map(|s| s.as_str().to_string());
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.first_name, t.last_name, t.email, t.phone,
                t.emergency_contact_name, t.emergency_contact_phone,
                t.assigned_unit_id,
                u.unit_number,
                p.id as property_id,
                p.name as property_name,
                t.lease_start_date, t.lease_end_date, t.status,
                t.created_at, t.updated_at
            FROM tenants t
            LEFT JOIN units u ON u.id = t.assigned_unit_id AND u.deleted_at IS NULL
            LEFT JOIN properties p ON p.id = u.property_id AND p.deleted_at IS NULL
            WHERE t.deleted_at IS NULL
              AND ($1::uuid IS NULL OR p.id = $1)
              AND ($2::text IS NULL OR t.status = $2)
              AND ($3::text IS NULL OR (
                  t.first_name ILIKE '%' || $3 || '%' OR 
                  t.last_name ILIKE '%' || $3 || '%' OR 
                  t.email ILIKE '%' || $3 || '%' OR 
                  u.unit_number ILIKE '%' || $3 || '%'
              ))
            ORDER BY t.created_at DESC
            "#
        )
        .bind(property_id)
        .bind(status_str)
        .bind(query)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list tenants: {}", e)))?;

        let tenants = rows
            .into_iter()
            .map(|r| {
                let status_val: String = r.get("status");
                TenantWithUnit {
                    id: r.get("id"),
                    first_name: r.get("first_name"),
                    last_name: r.get("last_name"),
                    email: r.get("email"),
                    phone: r.get("phone"),
                    emergency_contact_name: r.get("emergency_contact_name"),
                    emergency_contact_phone: r.get("emergency_contact_phone"),
                    assigned_unit_id: r.get("assigned_unit_id"),
                    unit_number: r.get("unit_number"),
                    property_id: r.get("property_id"),
                    property_name: r.get("property_name"),
                    lease_start_date: r.get("lease_start_date"),
                    lease_end_date: r.get("lease_end_date"),
                    status: TenantStatus::from_str(&status_val),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }
            })
            .collect();

        Ok(tenants)
    }

    async fn get_tenant(&self, id: Uuid) -> DomainResult<Option<TenantWithUnit>> {
        let row = sqlx::query(
            r#"
            SELECT 
                t.id, t.first_name, t.last_name, t.email, t.phone,
                t.emergency_contact_name, t.emergency_contact_phone,
                t.assigned_unit_id,
                u.unit_number,
                p.id as property_id,
                p.name as property_name,
                t.lease_start_date, t.lease_end_date, t.status,
                t.created_at, t.updated_at
            FROM tenants t
            LEFT JOIN units u ON u.id = t.assigned_unit_id AND u.deleted_at IS NULL
            LEFT JOIN properties p ON p.id = u.property_id AND p.deleted_at IS NULL
            WHERE t.id = $1 AND t.deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get tenant: {}", e)))?;

        Ok(row.map(|r| {
            let status_val: String = r.get("status");
            TenantWithUnit {
                id: r.get("id"),
                first_name: r.get("first_name"),
                last_name: r.get("last_name"),
                email: r.get("email"),
                phone: r.get("phone"),
                emergency_contact_name: r.get("emergency_contact_name"),
                emergency_contact_phone: r.get("emergency_contact_phone"),
                assigned_unit_id: r.get("assigned_unit_id"),
                unit_number: r.get("unit_number"),
                property_id: r.get("property_id"),
                property_name: r.get("property_name"),
                lease_start_date: r.get("lease_start_date"),
                lease_end_date: r.get("lease_end_date"),
                status: TenantStatus::from_str(&status_val),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            }
        }))
    }

    async fn create_tenant(&self, tenant: Tenant) -> DomainResult<Tenant> {
        let row = sqlx::query(
            r#"
            INSERT INTO tenants (
                id, first_name, last_name, email, phone,
                emergency_contact_name, emergency_contact_phone,
                assigned_unit_id, lease_start_date, lease_end_date, status,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, first_name, last_name, email, phone, emergency_contact_name, emergency_contact_phone, assigned_unit_id, lease_start_date, lease_end_date, status, created_at, updated_at
            "#
        )
        .bind(tenant.id)
        .bind(&tenant.first_name)
        .bind(&tenant.last_name)
        .bind(&tenant.email)
        .bind(&tenant.phone)
        .bind(&tenant.emergency_contact_name)
        .bind(&tenant.emergency_contact_phone)
        .bind(tenant.assigned_unit_id)
        .bind(tenant.lease_start_date)
        .bind(tenant.lease_end_date)
        .bind(tenant.status.as_str())
        .bind(tenant.created_at)
        .bind(tenant.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    return DomainError::Conflict(format!("Tenant with email '{}' already exists", tenant.email));
                }
            }
            DomainError::Internal(format!("Failed to create tenant: {}", e))
        })?;

        let status_val: String = row.get("status");
        Ok(Tenant {
            id: row.get("id"),
            first_name: row.get("first_name"),
            last_name: row.get("last_name"),
            email: row.get("email"),
            phone: row.get("phone"),
            emergency_contact_name: row.get("emergency_contact_name"),
            emergency_contact_phone: row.get("emergency_contact_phone"),
            assigned_unit_id: row.get("assigned_unit_id"),
            lease_start_date: row.get("lease_start_date"),
            lease_end_date: row.get("lease_end_date"),
            status: TenantStatus::from_str(&status_val),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn update_tenant(&self, tenant: Tenant) -> DomainResult<Tenant> {
        let row = sqlx::query(
            r#"
            UPDATE tenants
            SET first_name = $2, last_name = $3, email = $4, phone = $5,
                emergency_contact_name = $6, emergency_contact_phone = $7,
                assigned_unit_id = $8, lease_start_date = $9, lease_end_date = $10,
                status = $11, updated_at = $12
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, first_name, last_name, email, phone, emergency_contact_name, emergency_contact_phone, assigned_unit_id, lease_start_date, lease_end_date, status, created_at, updated_at
            "#
        )
        .bind(tenant.id)
        .bind(&tenant.first_name)
        .bind(&tenant.last_name)
        .bind(&tenant.email)
        .bind(&tenant.phone)
        .bind(&tenant.emergency_contact_name)
        .bind(&tenant.emergency_contact_phone)
        .bind(tenant.assigned_unit_id)
        .bind(tenant.lease_start_date)
        .bind(tenant.lease_end_date)
        .bind(tenant.status.as_str())
        .bind(tenant.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update tenant: {}", e)))?;

        let status_val: String = row.get("status");
        Ok(Tenant {
            id: row.get("id"),
            first_name: row.get("first_name"),
            last_name: row.get("last_name"),
            email: row.get("email"),
            phone: row.get("phone"),
            emergency_contact_name: row.get("emergency_contact_name"),
            emergency_contact_phone: row.get("emergency_contact_phone"),
            assigned_unit_id: row.get("assigned_unit_id"),
            lease_start_date: row.get("lease_start_date"),
            lease_end_date: row.get("lease_end_date"),
            status: TenantStatus::from_str(&status_val),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn delete_tenant(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("UPDATE tenants SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete tenant: {}", e)))?;
        Ok(())
    }

    // ------------------------------------------
    // Amenities
    // ------------------------------------------
    async fn list_amenities_by_property(&self, property_id: Uuid) -> DomainResult<Vec<AdminAmenity>> {
        let rows = sqlx::query(
            r#"
            SELECT id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at
            FROM amenities
            WHERE property_id = $1 AND deleted_at IS NULL
            ORDER BY name ASC
            "#
        )
        .bind(property_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list amenities: {}", e)))?;

        let amenities = rows
            .into_iter()
            .map(|r| AdminAmenity {
                id: r.get("id"),
                property_id: r.get("property_id"),
                name: r.get("name"),
                description: r.get("description"),
                capacity: r.get("capacity"),
                fee_cents: r.get("fee_cents"),
                deposit_cents: r.get("deposit_cents"),
                rules: r.get("rules"),
                is_active: r.get("is_active"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            })
            .collect();

        Ok(amenities)
    }

    async fn get_amenity(&self, id: Uuid) -> DomainResult<Option<AdminAmenity>> {
        let row = sqlx::query(
            r#"
            SELECT id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at
            FROM amenities
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get amenity: {}", e)))?;

        Ok(row.map(|r| AdminAmenity {
            id: r.get("id"),
            property_id: r.get("property_id"),
            name: r.get("name"),
            description: r.get("description"),
            capacity: r.get("capacity"),
            fee_cents: r.get("fee_cents"),
            deposit_cents: r.get("deposit_cents"),
            rules: r.get("rules"),
            is_active: r.get("is_active"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }))
    }

    async fn create_amenity(&self, amenity: AdminAmenity) -> DomainResult<AdminAmenity> {
        let row = sqlx::query(
            r#"
            INSERT INTO amenities (id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at
            "#
        )
        .bind(amenity.id)
        .bind(amenity.property_id)
        .bind(&amenity.name)
        .bind(&amenity.description)
        .bind(amenity.capacity)
        .bind(amenity.fee_cents)
        .bind(amenity.deposit_cents)
        .bind(&amenity.rules)
        .bind(amenity.is_active)
        .bind(amenity.created_at)
        .bind(amenity.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to create amenity: {}", e)))?;

        Ok(AdminAmenity {
            id: row.get("id"),
            property_id: row.get("property_id"),
            name: row.get("name"),
            description: row.get("description"),
            capacity: row.get("capacity"),
            fee_cents: row.get("fee_cents"),
            deposit_cents: row.get("deposit_cents"),
            rules: row.get("rules"),
            is_active: row.get("is_active"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn update_amenity(&self, amenity: AdminAmenity) -> DomainResult<AdminAmenity> {
        let row = sqlx::query(
            r#"
            UPDATE amenities
            SET name = $2, description = $3, capacity = $4, fee_cents = $5, deposit_cents = $6, rules = $7, is_active = $8, updated_at = $9
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at
            "#
        )
        .bind(amenity.id)
        .bind(&amenity.name)
        .bind(&amenity.description)
        .bind(amenity.capacity)
        .bind(amenity.fee_cents)
        .bind(amenity.deposit_cents)
        .bind(&amenity.rules)
        .bind(amenity.is_active)
        .bind(amenity.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update amenity: {}", e)))?;

        Ok(AdminAmenity {
            id: row.get("id"),
            property_id: row.get("property_id"),
            name: row.get("name"),
            description: row.get("description"),
            capacity: row.get("capacity"),
            fee_cents: row.get("fee_cents"),
            deposit_cents: row.get("deposit_cents"),
            rules: row.get("rules"),
            is_active: row.get("is_active"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn delete_amenity(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("UPDATE amenities SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete amenity: {}", e)))?;
        Ok(())
    }

    // ------------------------------------------
    // Parking Layout & Spots
    // ------------------------------------------
    async fn get_parking_layout(&self, property_id: Uuid) -> DomainResult<Option<ParkingLayoutWithSpots>> {
        let layout_row = sqlx::query(
            r#"
            SELECT id, property_id, canvas_width, canvas_height, grid_size, updated_at
            FROM parking_layouts
            WHERE property_id = $1
            "#
        )
        .bind(property_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to fetch parking layout: {}", e)))?;

        let layout = match layout_row {
            Some(r) => ParkingLayout {
                id: r.get("id"),
                property_id: r.get("property_id"),
                canvas_width: r.get("canvas_width"),
                canvas_height: r.get("canvas_height"),
                grid_size: r.get("grid_size"),
                updated_at: r.get("updated_at"),
            },
            None => return Ok(None),
        };

        let spot_rows = sqlx::query(
            r#"
            SELECT 
                s.id, s.layout_id, s.spot_label, s.x, s.y, s.width, s.height, s.rotation, s.spot_type, s.is_occupied, s.assigned_tenant_id,
                CASE WHEN t.id IS NOT NULL THEN t.first_name || ' ' || t.last_name ELSE NULL END as tenant_name,
                s.created_at, s.updated_at
            FROM parking_spots s
            LEFT JOIN tenants t ON t.id = s.assigned_tenant_id AND t.deleted_at IS NULL
            WHERE s.layout_id = $1
            ORDER BY s.spot_label ASC
            "#
        )
        .bind(layout.id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to fetch parking spots: {}", e)))?;

        let spots = spot_rows
            .into_iter()
            .map(|r| {
                let type_str: String = r.get("spot_type");
                ParkingSpot {
                    id: r.get("id"),
                    layout_id: r.get("layout_id"),
                    spot_label: r.get("spot_label"),
                    x: r.get("x"),
                    y: r.get("y"),
                    width: r.get("width"),
                    height: r.get("height"),
                    rotation: r.get("rotation"),
                    spot_type: SpotType::from_str(&type_str),
                    is_occupied: r.get("is_occupied"),
                    assigned_tenant_id: r.get("assigned_tenant_id"),
                    tenant_name: r.get("tenant_name"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }
            })
            .collect();

        Ok(Some(ParkingLayoutWithSpots { layout, spots }))
    }

    async fn save_parking_layout(
        &self,
        property_id: Uuid,
        canvas_width: i32,
        canvas_height: i32,
        grid_size: i32,
        spots: Vec<ParkingSpot>,
    ) -> DomainResult<ParkingLayoutWithSpots> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to start parking layout transaction: {}", e)))?;

        let layout_id = Uuid::new_v4();

        // 1. Atomic Upsert of Layout
        let layout_row = sqlx::query(
            r#"
            INSERT INTO parking_layouts (id, property_id, canvas_width, canvas_height, grid_size, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (property_id) DO UPDATE
            SET canvas_width = EXCLUDED.canvas_width,
                canvas_height = EXCLUDED.canvas_height,
                grid_size = EXCLUDED.grid_size,
                updated_at = NOW()
            RETURNING id, property_id, canvas_width, canvas_height, grid_size, updated_at
            "#
        )
        .bind(layout_id)
        .bind(property_id)
        .bind(canvas_width)
        .bind(canvas_height)
        .bind(grid_size)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to upsert parking layout: {}", e)))?;

        let active_layout_id: Uuid = layout_row.get("id");
        let layout = ParkingLayout {
            id: active_layout_id,
            property_id: layout_row.get("property_id"),
            canvas_width: layout_row.get("canvas_width"),
            canvas_height: layout_row.get("canvas_height"),
            grid_size: layout_row.get("grid_size"),
            updated_at: layout_row.get("updated_at"),
        };

        // 2. Clear previous spots for this layout atomically
        sqlx::query("DELETE FROM parking_spots WHERE layout_id = $1")
            .bind(active_layout_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to clear old parking spots: {}", e)))?;

        // 3. Batch insert new spots
        let mut saved_spots = Vec::new();
        for spot in spots {
            let spot_id = if spot.id.is_nil() { Uuid::new_v4() } else { spot.id };
            let now = Utc::now();

            sqlx::query(
                r#"
                INSERT INTO parking_spots (
                    id, layout_id, spot_label, x, y, width, height, rotation, spot_type, is_occupied, assigned_tenant_id, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                "#
            )
            .bind(spot_id)
            .bind(active_layout_id)
            .bind(&spot.spot_label)
            .bind(spot.x)
            .bind(spot.y)
            .bind(spot.width)
            .bind(spot.height)
            .bind(spot.rotation)
            .bind(spot.spot_type.as_str())
            .bind(spot.is_occupied)
            .bind(spot.assigned_tenant_id)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to insert spot '{}': {}", spot.spot_label, e)))?;

            saved_spots.push(ParkingSpot {
                id: spot_id,
                layout_id: active_layout_id,
                spot_label: spot.spot_label,
                x: spot.x,
                y: spot.y,
                width: spot.width,
                height: spot.height,
                rotation: spot.rotation,
                spot_type: spot.spot_type,
                is_occupied: spot.is_occupied,
                assigned_tenant_id: spot.assigned_tenant_id,
                tenant_name: None,
                created_at: now,
                updated_at: now,
            });
        }

        tx.commit()
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to commit parking layout transaction: {}", e)))?;

        Ok(ParkingLayoutWithSpots { layout, spots: saved_spots })
    }
}
