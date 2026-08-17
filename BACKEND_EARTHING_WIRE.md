# Backend — Earthing wire brand + size on quotations

**Frontend (live):** Quotation product form → **Earthing Wire** (brand + size dropdowns, As per the set / presets / custom)  
**FE code:** `components/product-selection-form.tsx` · `lib/quotation-context.tsx` · `lib/quotation-proposal-document.ts`  
**BE repo:** `inventorybackend` · table `quotation_products`

---

## Must ship

| # | Deliverable | If missing |
|---|-------------|------------|
| **E1** | Columns `earthingWireSize` + `earthingWireBrand` (`STRING(100)`, nullable) | Save drops fields; edit reverts |
| **E2** | Create + update accept camelCase **and** snake_case | FE payload ignored |
| **E3** | GET quotation returns both on `products` | Form/PDF blank after reload |
| **E4** | Free-text allowed (no cable-catalog enum check) | Custom brand/size → 400 |
| **E5** | Update path persists changes (e.g. `2mm` → `As per the set`) | Size/brand stuck after save |

---

## Allowed values (FE sends these strings)

### `earthingWireSize`
| Value | Notes |
|-------|--------|
| `As per the set` | Package default |
| `2mm` / `4mm` / `6mm` | Presets |
| any other string | Custom (e.g. `8mm`) |

### `earthingWireBrand`
| Value | Notes |
|-------|--------|
| `As per the set` | Package default |
| `JMP` / `Polycab` / `Havells` / `KEI` / `Finolex` | Presets |
| any other string | Custom |

---

## API contract

### Create / update (body excerpt)

```http
POST /api/quotations
PUT  /api/quotations/:id
PATCH /api/quotations/:id
```

```json
{
  "products": {
    "earthingWireBrand": "Polycab",
    "earthing_wire_brand": "Polycab",
    "earthingWireSize": "As per the set",
    "earthing_wire_size": "As per the set"
  }
}
```

Accept either key; store camelCase columns.

### GET response (excerpt)

```json
{
  "products": {
    "earthingWireBrand": "Polycab",
    "earthing_wire_brand": "Polycab",
    "earthingWireSize": "As per the set",
    "earthing_wire_size": "As per the set"
  }
}
```

---

## Migrations (already in inventorybackend)

```bash
cd inventorybackend
npx sequelize-cli db:migrate
```

| File | Column |
|------|--------|
| `database/migrations/20260817140000-add-earthing-wire-size-to-quotation-products.js` | `earthingWireSize` |
| `database/migrations/20260817150000-add-earthing-wire-brand-to-quotation-products.js` | `earthingWireBrand` |

Also wired in:

- `models/QuotationProduct.ts`
- `validations/quotationValidations.ts`
- `utils/quotationProductPdfDisplay.ts` (`QUOTATION_PRODUCT_COLUMN_KEYS`)
- `utils/quotationApiJson.ts` (GET mapper)
- `controllers/quotationController.ts` (create)
- `controllers/workflowController.ts`

---

## Optional

`systemConfigs[].earthingWireBrand` / `earthingWireSize` on pricing tables — FE defaults to **JMP** + **As per the set** when absent.

---

## QA

- [ ] Migrate DB on staging/prod
- [ ] Create with brand `Polycab`, size `4mm` → GET returns both
- [ ] Edit size `2mm` → `As per the set` → save → GET shows `As per the set`
- [ ] Edit brand `JMP` → `Havells` → persists
- [ ] Custom brand + custom size (`8mm`) → 200, no catalog error
- [ ] Proposal PDF Lightning Arrestor & Earthing shows brand + size
