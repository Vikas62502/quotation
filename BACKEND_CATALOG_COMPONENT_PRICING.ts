// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Admin Catalog Price set (component pricing)  (Nov 26 2026)
 * =============================================================================
 * Frontend (shipped):
 *   - Admin → Catalog → Price set tabs (Panel / Inverter / Structure / Cable /
 *     Meter / Accessories). No dummy seed — empty until admin saves.
 *   - Project Estimated Cost loads brands/prices from the same payload.
 *   - GST (estimate only): Panel/Inverter 5%, Structure/Cable/Meter/Accessories
 *     18%, Other 0%.
 *
 * API:
 *   GET  /api/quotations/catalog-component-pricing
 *   PUT  /api/quotations/catalog-component-pricing   (admin only)
 *   Aliases:
 *   GET  /api/config/catalog-component-pricing
 *   PUT  /api/config/catalog-component-pricing       (admin only)
 *
 * Storage (inventorybackend — shipped):
 *   system_config.configKey = 'catalog_component_pricing'
 *   configValue = JSON.stringify({ version: 1, categories: { … } })
 *
 * Files (inventorybackend):
 *   utils/catalogComponentPricing.ts
 *   controllers/configController.ts  — getCatalogComponentPricing /
 *                                      updateCatalogComponentPricing
 *   routes/quotationRoutes.ts
 *   routes/configRoutes.ts
 *
 * FE:
 *   lib/catalog-component-pricing.ts
 *   lib/api.ts — quotations.getCatalogComponentPricing /
 *                updateCatalogComponentPricing
 *   components/admin-catalog-component-pricing.tsx
 *   components/admin-project-estimated-cost.tsx
 * =============================================================================
 */

/**
 * Payload shape:
 * {
 *   version: 1,
 *   categories: {
 *     panel: { brands: [{ name, rows: [{ id, brand, contentType, spec, perWattPrice, … }] }] },
 *     inverter: { brands: [{ name, rows: [{ id, brand, kw, phases, singleString, price }] }] },
 *     structure: { brands: [{ name, rows: [{ id, brand, product, measurement, quantity, perKgPrice, perPiecePrice }] }] },
 *     cable: { brands: [{ name, rows: [{ id, brand, mmThickness, perMeterPrice }] }] },
 *     meter: { brands: [{ name, rows: [{ id, brand, phases, perPiecePrice }] }] },
 *     accessories: { brands: [{ name, rows: [{ id, brand, product, perPiecePrice }] }] }
 *   }
 * }
 *
 * PUT replaces the full document (FE draft until Save).
 * GET returns empty categories when no row exists yet.
 *
 * curl:
 *   curl -s http://localhost:3050/api/quotations/catalog-component-pricing \
 *     -H "Authorization: Bearer $TOKEN"
 *
 *   curl -s -X PUT http://localhost:3050/api/quotations/catalog-component-pricing \
 *     -H 'Content-Type: application/json' \
 *     -H "Authorization: Bearer $TOKEN" \
 *     -d '{"version":1,"categories":{"panel":{"brands":[]},"inverter":{"brands":[]},"structure":{"brands":[]},"cable":{"brands":[]},"meter":{"brands":[]},"accessories":{"brands":[]}}}'
 */

/**
 * Acceptance:
 * [ ] GET returns { success, data: { version: 1, categories: { panel… } } }
 * [ ] Empty DB → empty brand arrays (no seed / dummy)
 * [ ] Admin PUT persists; next GET echoes saved rows
 * [ ] Non-admin PUT → 403
 * [ ] Price set Save in Admin shows success and survives refresh
 * [ ] Project Estimated Cost Refresh loads saved brands/prices
 */
