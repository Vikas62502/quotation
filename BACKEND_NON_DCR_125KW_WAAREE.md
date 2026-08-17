# Backend — Non-DCR Waaree 125kW set (Aug 2026)

**Frontend (live):** Browse NON DCR → **125kW (3-Phase) · Waaree · ₹35,62,500**  
**Code:** `lib/pricing-tables.ts` · `lib/quotation-data.ts` · `lib/use-product-catalog.ts`  
**Related:** `BACKEND_NON_DCR_80KW.md`, `BACKEND_PRICING_TABLES_API.md`

---

## Product summary

| Item | Value |
|------|--------|
| System | **Non-DCR**, **125kW**, **3-Phase** |
| Panel brand | **Waaree** |
| Default panel size (preset) | **580W** (user may change, e.g. **705W**) |
| Inverter | **Vsole/Xwatt** **125kW** |
| Structure | **GI Structure** **125kW** |
| Set price | **₹35,62,500** (`3562500`) |
| Subsidy | **0** (Non-DCR) |

PDF: selected wattage must be returned/persisted as-is (e.g. **705W**). Do not rewrite to 615W on the API.

---

## Checklist

| # | Item | Status |
|---|------|--------|
| **N1** | Add Non-DCR pricing row (below) to `GET/PUT /quotations/pricing-tables` → `nonDcr[]` | **Done** (inventorybackend) |
| **N2** | Add system config preset for Waaree 125kW (below) → `systemConfigs[]` / `systemConfigurations` | **Done** |
| **N3** | Product catalog: allow **`125kW`** on inverters + structures | **Done** |
| **N4** | Product catalog: allow panel size **`705W`** (and other high-W Waaree sizes if used) | **Done** |
| **N5** | Create / `PATCH …/products` must accept `inverterSize: "125kW"`, `structureSize: "125kW"`, `panelSize: "705W"` without 400 | **Done** |
| **N6** | Echo fields on GET; subtotal / `systemPrice` **3562500** when this set is selected | **Done** |

---

## A) Pricing table row

### `data.nonDcr[]`

```json
{
  "systemSize": "125kW",
  "phase": "3-Phase",
  "inverterSize": "125kW",
  "panelType": "Waaree",
  "price": 3562500
}
```

### `data.systemConfigs[]` (preset)

```json
{
  "systemType": "non-dcr",
  "systemSize": "125kW",
  "phase": "3-Phase",
  "panelBrand": "Waaree",
  "panelSize": "580W",
  "inverterBrand": "Vsole/Xwatt",
  "inverterSize": "125kW",
  "inverterType": "String Inverter",
  "structureType": "GI Structure",
  "structureSize": "125kW",
  "meterBrand": "L&T",
  "acCableBrand": "Polycab",
  "acCableSize": "As per Set",
  "dcCableBrand": "Polycab",
  "dcCableSize": "As per Set",
  "acdb": "Havells (3-Phase)",
  "dcdb": "Havells (3-Phase)"
}
```

**How to ship if DB already has pricing-tables JSON:**

1. Admin → Pricing → Save after adding the row, **or**
2. `PUT /api/quotations/pricing-tables` with full payload including the new `nonDcr` + `systemConfigs` entries (merge into existing arrays; do not drop other rows).

Until API includes this row, FE merges it locally so browse still shows 125kW — **save still needs catalog allowlists (N3–N5)**.

---

## B) Product catalog allowlists

`GET/PUT /api/config/products` (or whatever backs quotation product validation):

| Path | Add |
|------|-----|
| `panels.sizes` | **`705W`** (and optionally `700W`, `640W`, … if sold) |
| `inverters.sizes` | **`125kW`** |
| `structures.sizes` | **`125kW`** |

Do **not** reject free-text panel sizes that match `\d+W` if you already allow custom sizes; if validation is strict, **705W must be listed**.

---

## C) Quotation products example

```http
PATCH /api/quotations/{id}/products
Authorization: Bearer <dealer|admin>
Content-Type: application/json
```

```json
{
  "systemType": "non-dcr",
  "phase": "3-Phase",
  "panelBrand": "Waaree",
  "panelSize": "705W",
  "panelQuantity": 177,
  "inverterBrand": "Vsole/Xwatt",
  "inverterSize": "125kW",
  "inverterType": "String Inverter",
  "structureType": "GI Structure",
  "structureSize": "125kW",
  "meterBrand": "L&T",
  "acCableBrand": "Polycab",
  "acCableSize": "As per Set",
  "dcCableBrand": "Polycab",
  "dcCableSize": "As per Set",
  "acdb": "Havells (3-Phase)",
  "dcdb": "Havells (3-Phase)",
  "centralSubsidy": 0,
  "stateSubsidy": 0,
  "systemPrice": 3562500
}
```

Persist **`panelSize: "705W"`** exactly. Proposal PDF uses the stored wattage (Topcon Bifacial label is FE-only).

---

## D) QA

1. `GET /quotations/pricing-tables` → `nonDcr` contains Waaree **125kW** @ **3562500**.
2. Browse NON DCR on FE shows the set without relying only on FE merge.
3. Create quotation: Waaree 125kW, change panel to **705W** → save succeeds.
4. GET products → `panelSize: "705W"`, `inverterSize: "125kW"`, price/subtotal **3562500**.
5. Proposal PDF shows **705W Topcon Bifacial** (not 615W).

---

## Repo implementation notes (`inventorybackend`)

| File | Change |
|------|--------|
| `BACKEND_PRICING_TABLES_SEED.json` | `nonDcr` + `systemConfigs` Waaree 125kW |
| `utils/defaultPricingTables.ts` | Fallback + GET/PUT inject if missing |
| `utils/defaultProductCatalog.ts` | `705W`, merge defaults for `125kW` sizes |
| `utils/productCatalogNormalize.ts` | Merge inverter/structure size defaults including **125kW**; allow `\d+W` |
| `database/migrations/20260817160000-add-non-dcr-waaree-125kw-pricing.js` | Live DB merge |

`GET /quotations/pricing-tables` serves 125kW even if FE local merge is off. Selected `panelSize` (e.g. **705W**) is persisted as-is.
