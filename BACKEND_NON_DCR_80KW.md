# Backend handoff — Non-DCR 80kW set (Renew Energy / Waaree / Adani) — Jul 2026

**Frontend (already shipped):**
- `lib/pricing-tables.ts` — Non-DCR 80kW set prices + presets (Vsole/Xwatt)
- `lib/quotation-pdf-display.ts` — new PDF panel range keys
- `lib/quotation-proposal-document.ts` — 20kW+ ACDB/DCDB → **CT / BT** (“As per the set”)
- `components/product-selection-form.tsx` — auto-selects PDF range on 80kW Non-DCR package pick

**Related:** `BACKEND_PRICING_TABLES_API.md`, HANDOFF §2.1 (PDF panel range keys), `GET /quotations/pricing-tables`

---

## Product summary

| Item | Value |
|------|--------|
| System | **Non-DCR**, **80kW**, **3-Phase**, inverter **Vsole/Xwatt** **80kW** |
| Renew Energy set price | **₹25,10,000** |
| Waaree set price | **₹25,90,000** |
| Adani set price | **₹25,90,000** |
| Renew Energy panel range (PDF) | **600W - 630W** |
| Waaree panel range (PDF) | **580W - 630W** |
| Adani panel range (PDF) | **600W - 630W** |
| ≥20kW PDF distribution labels | Component **CT / BT**; brand **As per the set / As per the set** |

Panel brand string must be **`Renew Energy`** (not `RenewSys`) for this package.

---

## Checklist — backend must deliver

| # | Item |
|---|------|
| 1 | Persist + echo new `pdfPanelRangeKey` values (below) on products PATCH/GET |
| 2 | Allow `panelBrand` / catalog brand **`Renew Energy`** (do not coerce to Adani / RenewSys) |
| 3 | Allow Non-DCR **80kW** + inverter **80kW** in validation / pricing-tables |
| 4 | If serving `GET /quotations/pricing-tables`, include 80kW Non-DCR rows + presets |
| 5 | Do **not** reject empty / “As per the set” ACDB·DCDB when PDF uses CT/BT for ≥20kW (optional strictness) |

---

## A) New PDF panel range keys (persist + allowlist)

Store on quotation products (camelCase + snake_case aliases):

| Key | Brand | PDF label |
|-----|--------|-----------|
| `renew_energy_600_630` | Renew Energy | 600W - 630W |
| `waaree_580_630` | Waaree | 580W - 630W |
| `adani_600_630` | Adani | 600W - 630W |

Also still valid (existing): `waaree_*`, `adani_*`, `renewsys_*`, `tata_530_570`, `ina_500_600_bifacial`, etc.

### Persist fields

```json
{
  "pdfPanelRangeKey": "renew_energy_600_630",
  "pdf_panel_range_key": "renew_energy_600_630",
  "pdfUsePanelSizeRange": true,
  "pdf_use_panel_size_range": true,
  "panelBrand": "Renew Energy",
  "panelSize": "600W",
  "inverterBrand": "Vsole/Xwatt",
  "inverterSize": "80kW",
  "systemType": "non-dcr",
  "phase": "3-Phase"
}
```

**Rules (same as HANDOFF §2.1):**
- Accept keys on `PATCH /quotations/{id}/products` (and create flow).
- Echo on every GET list/detail.
- Empty string / null clears the key (do not leave stale ranges).
- When range key is set, `panelQuantity` may be `0` / omitted for PDF “As Per BOM” — do not 400.

---

## B) Non-DCR pricing table / set prices

If backend owns `GET /api/quotations/pricing-tables` (or admin catalog), add:

### `data.nonDcr[]`

```json
[
  { "systemSize": "80kW", "phase": "3-Phase", "inverterSize": "80kW", "panelType": "Renew Energy", "price": 2510000 },
  { "systemSize": "80kW", "phase": "3-Phase", "inverterSize": "80kW", "panelType": "Waaree", "price": 2590000 },
  { "systemSize": "80kW", "phase": "3-Phase", "inverterSize": "80kW", "panelType": "Adani", "price": 2590000 }
]
```

### `data.systemConfigurations` / presets (Non-DCR 80kW)

| panelBrand | panelSize (seed) | inverterBrand | inverterSize | set price via nonDcr |
|------------|------------------|---------------|--------------|----------------------|
| Renew Energy | 600W | Vsole/Xwatt | 80kW | 2510000 |
| Waaree | 580W | Vsole/Xwatt | 80kW | 2590000 |
| Adani | 600W | Vsole/Xwatt | 80kW | 2590000 |

ACDB/DCDB on form may still be `Havells (3-Phase)`; **PDF** renames to CT/BT client-side for ≥20kW. No need to store “CT”/“BT” unless you want parity on GET.

### Brand validation

Allowlist / enum must include:

- `Renew Energy` (required for this package)
- Existing: Adani, Waaree, Tata, RenewSys, …  

Do **not** map `Renew Energy` → `Adani` or force `RenewSys` forever — preferred is to **add `Renew Energy` to the product catalog**.

**Frontend workaround (until catalog updated):** API payloads temporarily send catalog brand **`RenewSys`** with markers `panelType: "Renew Energy"` / `renewEnergyPackage: true`, and map PDF range `renew_energy_600_630` → `renewsys_600_630_bifacial_topcon` for validation. UI restores **Renew Energy** + `renew_energy_600_630` after save.

---

## C) Quotation create / PATCH products — example body

```http
PATCH /api/quotations/{id}/products
Authorization: Bearer <dealer|admin>
Content-Type: application/json
```

```json
{
  "systemType": "non-dcr",
  "phase": "3-Phase",
  "panelBrand": "Renew Energy",
  "panelSize": "600W",
  "panelQuantity": 0,
  "inverterBrand": "Vsole/Xwatt",
  "inverterSize": "80kW",
  "inverterType": "String Inverter",
  "structureType": "GI Structure",
  "structureSize": "80kW",
  "acdb": "Havells (3-Phase)",
  "dcdb": "Havells (3-Phase)",
  "pdfPanelRangeKey": "renew_energy_600_630",
  "pdfUsePanelSizeRange": true,
  "centralSubsidy": 0,
  "stateSubsidy": 0
}
```

Pricing / subtotal should match set price (**2510000** for Renew Energy). Prefer client-sent `systemPrice` / `pricing.subtotal` if you already accept them; otherwise resolve from Non-DCR table.

Same pattern for Waaree (`pdfPanelRangeKey: "waaree_580_630"`, price **2590000**) and Adani (`"adani_600_630"`, **2590000**).

---

## D) PDF note (frontend-owned; backend only persists fields)

For system size **≥ 20kW** (including 80kW):

| PDF row | Display |
|---------|---------|
| Component | **CT / BT** (not ACDB / DCDB) |
| Brand / model | **As per the set / As per the set** |

No dedicated API field required for CT/BT — derived from system kW on the client.

---

## E) QA

1. Create Non-DCR **80kW Renew Energy** quotation → save → GET returns `panelBrand: "Renew Energy"`, `pdfPanelRangeKey: "renew_energy_600_630"`, subtotal **2510000**.
2. Same for Waaree / Adani with correct price + range keys.
3. Soft refresh / other device: ranges and brand still present.
4. Uncheck PDF range in UI → PATCH with empty key → GET has null/absent key.
5. Catalog validation does **not** 400 on `Renew Energy`, `80kW`, or new range keys.
6. If pricing-tables API is live: response includes the three 80kW Non-DCR rows.

---

## Frontend source of truth (until API sync)

Fallback when pricing-tables API missing: `lib/pricing-tables.ts` (`nonDcrPricing` + Non-DCR system presets).  
Range catalog: `lib/quotation-pdf-display.ts` (`renew_energy_600_630`, `waaree_580_630`, `adani_600_630`).
