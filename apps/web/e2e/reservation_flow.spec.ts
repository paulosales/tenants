import { test, expect } from '@playwright/test';

test.describe('Property & Tenant Platform End-to-End User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local web frontend
    await page.goto('http://localhost:5173');
  });

  test('completes parking spot reservation and amenity booking', async ({ page }) => {
    // 1. Verify Platform Header
    await expect(page.locator('text=Apex Living')).toBeVisible();

    // 2. Select Parking Spot on SVG Map
    const spotP101 = page.locator('text=P1-01');
    await expect(spotP101).toBeVisible();
    await spotP101.click();

    // 3. Inspect Spot Details and Reserve
    await expect(page.locator('text=Slot Identifier')).toBeVisible();
    const reserveButton = page.locator('button:has-text("Reserve Spot P1-01")');
    await expect(reserveButton).toBeEnabled();
    await reserveButton.click();

    // 4. Verify Spot Reserved Confirmation
    await expect(page.locator('text=Spot P1-01 successfully reserved!')).toBeVisible();

    // 5. Navigate to Amenities Calendar Tab
    await page.click('button:has-text("Amenities")');
    await expect(page.locator('text=Skyline Rooftop Lounge')).toBeVisible();

    // 6. Schedule Reservation
    const confirmAmenityButton = page.locator('button:has-text("Confirm & Reserve Slot")');
    await expect(confirmAmenityButton).toBeVisible();
    await confirmAmenityButton.click();

    // 7. Verify Optimistic Calendar Update
    await expect(page.locator('text=Amenity slot secured and confirmed!')).toBeVisible();
  });
});
