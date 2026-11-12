use chrono::{DateTime, Timelike, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::errors::{DomainError, DomainResult};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Amenity {
    pub id: Uuid,
    pub property_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub capacity: i32,
    pub hourly_rate_cents: i32,
    pub min_duration_minutes: i32,
    pub max_duration_minutes: i32,
    pub open_time_minutes: i32, // minutes from midnight (e.g. 480 = 08:00)
    pub close_time_minutes: i32, // minutes from midnight (e.g. 1320 = 22:00)
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Amenity {
    pub fn open_time_formatted(&self) -> String {
        format!(
            "{:02}:{:02}",
            self.open_time_minutes / 60,
            self.open_time_minutes % 60
        )
    }

    pub fn close_time_formatted(&self) -> String {
        format!(
            "{:02}:{:02}",
            self.close_time_minutes / 60,
            self.close_time_minutes % 60
        )
    }

    pub fn validate_slot(&self, start: DateTime<Utc>, end: DateTime<Utc>) -> DomainResult<()> {
        if end <= start {
            return Err(DomainError::ValidationError(
                "End time must be after start time".into(),
            ));
        }

        let duration_mins = (end - start).num_minutes();
        if duration_mins < self.min_duration_minutes as i64
            || duration_mins > self.max_duration_minutes as i64
        {
            return Err(DomainError::InvalidDuration {
                duration_mins,
                min_mins: self.min_duration_minutes,
                max_mins: self.max_duration_minutes,
            });
        }

        let start_time_mins = (start.time().hour() * 60 + start.time().minute()) as i32;
        let end_time_mins = (end.time().hour() * 60 + end.time().minute()) as i32;

        if start_time_mins < self.open_time_minutes || end_time_mins > self.close_time_minutes {
            return Err(DomainError::OutsideOperatingHours {
                open_time: self.open_time_formatted(),
                close_time: self.close_time_formatted(),
            });
        }

        Ok(())
    }

    pub fn calculate_price_cents(&self, start: DateTime<Utc>, end: DateTime<Utc>) -> i32 {
        let duration_minutes = (end - start).num_minutes();
        let hours_fraction = (duration_minutes as f64) / 60.0;
        (hours_fraction * (self.hourly_rate_cents as f64)).ceil() as i32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn test_amenity() -> Amenity {
        Amenity {
            id: Uuid::new_v4(),
            property_id: None,
            name: "Rooftop Tennis Court".into(),
            description: None,
            capacity: 4,
            hourly_rate_cents: 2500, // $25.00/hr
            min_duration_minutes: 60,
            max_duration_minutes: 180,
            open_time_minutes: 480,   // 08:00
            close_time_minutes: 1320, // 22:00
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        }
    }

    #[test]
    fn test_valid_reservation_slot() {
        let amenity = test_amenity();
        let start = Utc.with_ymd_and_hms(2026, 11, 1, 10, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2026, 11, 1, 12, 0, 0).unwrap(); // 2 hours

        let res = amenity.validate_slot(start, end);
        assert!(res.is_ok());

        let price = amenity.calculate_price_cents(start, end);
        assert_eq!(price, 5000); // 2 hrs * $25 = $50.00 (5000 cents)
    }

    #[test]
    fn test_rejects_slot_outside_operating_hours() {
        let amenity = test_amenity();
        // 06:00 to 07:30 (before open time 08:00)
        let start = Utc.with_ymd_and_hms(2026, 11, 1, 6, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2026, 11, 1, 7, 30, 0).unwrap();

        let res = amenity.validate_slot(start, end);
        assert!(matches!(
            res,
            Err(DomainError::OutsideOperatingHours { .. })
        ));
    }

    #[test]
    fn test_rejects_duration_less_than_minimum() {
        let amenity = test_amenity();
        // 30 minutes duration (min is 60m)
        let start = Utc.with_ymd_and_hms(2026, 11, 1, 10, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2026, 11, 1, 10, 30, 0).unwrap();

        let res = amenity.validate_slot(start, end);
        assert!(matches!(res, Err(DomainError::InvalidDuration { .. })));
    }

    #[test]
    fn test_rejects_end_before_start() {
        let amenity = test_amenity();
        let start = Utc.with_ymd_and_hms(2026, 11, 1, 12, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2026, 11, 1, 10, 0, 0).unwrap();

        let res = amenity.validate_slot(start, end);
        assert!(matches!(res, Err(DomainError::ValidationError(_))));
    }
}
