import { test, expect } from "@playwright/test";

test.describe("Libraries flow", () => {
  test("browse library from canvas, add icons, and see them in the sidebar", async ({
    page,
  }) => {
    // 1. Go to the main canvas
    await page.goto("/");
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15_000 });

    // 2. Open the library sidebar — click the "Library" button
    const libraryButton = page.getByRole("button", {
      name: "Library",
      exact: true,
    });
    await libraryButton.click();

    // 3. The browse button should appear inside the sidebar
    const browseButton = page.locator("a.library-menu-browse-button");
    await expect(browseButton).toBeVisible({ timeout: 10_000 });

    // Confirm it links to /libraries with canvas-mode params
    const href = await browseButton.getAttribute("href");
    expect(href).toContain("/libraries");
    expect(href).toContain("target=_excalidraw");

    // 4. Click "Browse libraries" — navigates to /libraries in canvas mode
    await browseButton.click();
    await expect(page).toHaveURL(/\/libraries/, { timeout: 10_000 });

    // Wait for the Libraries page to render
    await expect(
      page.locator("h1").filter({ hasText: /Libraries/ }),
    ).toBeVisible({ timeout: 10_000 });

    // The "Back to canvas" bar should be visible (canvas mode)
    const backToCanvasLink = page.locator("a").filter({
      hasText: "Back to canvas",
    });
    await expect(backToCanvasLink.first()).toBeVisible();

    // 5. Click "+ Add to Excalidraw" on the first library card
    const addButton = page
      .getByRole("button", { name: /Add to Excalidraw/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // 6. Verify snackbar confirmation
    const snackbar = page.locator("[role='status']");
    await expect(snackbar).toContainText("was added to your library", {
      timeout: 5_000,
    });

    // The button should now show "Remove"
    await expect(
      page.getByRole("button", { name: /Remove/i }).first(),
    ).toBeVisible();

    // 7. Click "Back to canvas" — carries #addLibrary=<url> in the hash
    //    so useHandleLibrary loads the icons into the sidebar
    await backToCanvasLink.first().click();

    // Should be back on the main canvas
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15_000 });

    // 8. Open the library sidebar and verify icons appeared
    const libraryButtonAfter = page.getByRole("button", {
      name: "Library",
      exact: true,
    });
    if (
      !(await page
        .locator("a.library-menu-browse-button")
        .isVisible()
        .catch(() => false))
    ) {
      await libraryButtonAfter.click();
    }

    await expect(
      page.locator("a.library-menu-browse-button"),
    ).toBeVisible({ timeout: 10_000 });

    // 9. Verify library items appear in the sidebar panel
    const libraryItems = page.locator(".library-unit");
    await expect(libraryItems.first()).toBeVisible({ timeout: 20_000 });

    const itemCount = await libraryItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test("add icons from /libraries directly, then see them on canvas sidebar", async ({
    page,
  }) => {
    // 1. Navigate directly to /libraries (non-canvas mode)
    //    This writes to PENDING_LOADS_KEY in localStorage
    await page.goto("/libraries");

    await expect(
      page.locator("h1").filter({ hasText: /Libraries/ }),
    ).toBeVisible({ timeout: 10_000 });

    // 2. Add the first library
    const addButtons = page.getByRole("button", {
      name: /Add to Excalidraw/i,
    });
    await expect(addButtons.first()).toBeVisible({ timeout: 10_000 });
    await addButtons.first().click();

    // Verify the snackbar
    await expect(page.locator("[role='status']")).toContainText(
      "was added to your library",
      { timeout: 5_000 },
    );

    // The button should now show "Remove"
    await expect(
      page.getByRole("button", { name: /Remove/i }).first(),
    ).toBeVisible();

    // 3. Optionally add a second library if available
    const remainingAddButtons = page.getByRole("button", {
      name: /Add to Excalidraw/i,
    });
    const hasSecond = (await remainingAddButtons.count()) > 0;
    if (hasSecond) {
      await remainingAddButtons.first().click();
      await expect(page.locator("[role='status']")).toContainText(
        "was added to your library",
        { timeout: 5_000 },
      );
    }

    // 4. Navigate to the canvas
    await page.goto("/");
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15_000 });

    // 5. Open the library sidebar
    const libraryButton = page.getByRole("button", {
      name: "Library",
      exact: true,
    });
    await libraryButton.click();

    const browseButton = page.locator("a.library-menu-browse-button");
    await expect(browseButton).toBeVisible({ timeout: 10_000 });

    // 6. Verify library items loaded from PENDING_LOADS_KEY
    const libraryItems = page.locator(".library-unit");
    await expect(libraryItems.first()).toBeVisible({ timeout: 20_000 });

    const itemCount = await libraryItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });
});
