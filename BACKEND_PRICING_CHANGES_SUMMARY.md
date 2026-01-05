# Backend Changes Summary: Pricing Tables API

**Date:** December 30, 2025  
**Priority:** HIGH - Frontend depends on this

---

## Quick Summary

The frontend now requires a new API endpoint to fetch complete pricing tables and system configuration presets. This enables:
- Dropdown selection of pre-configured systems
- Auto-population of all product fields
- Dynamic pricing from backend

**CRITICAL PRICING MODEL:**
- **Set Prices (DCR, NON DCR, BOTH)**: Complete package prices including ALL components (panels, inverter, structure, meter, cables, ACDB, DCDB)
- **Individual Component Prices**: Only used for "customize" system type
- For DCR/NON DCR/BOTH: Use set price as-is (complete package)
- For customize: Calculate from individual component prices

---

## Required Endpoint

### `GET /api/quotations/pricing-tables`

**Returns:** Complete pricing data including:
1. System pricing (DCR, NON DCR, BOTH)
2. Component pricing (panels, inverters, structures, meters, cables, ACDB, DCDB)
3. System configuration presets (for dropdown auto-fill)

---

## Key Data Structures

### System Configuration Preset (Most Important)
```json
{
  "systemType": "dcr",
  "systemSize": "5kW",
  "panelBrand": "Adani",
  "panelSize": "545W",
  "inverterBrand": "Polycab",
  "inverterSize": "5kW",
  "inverterType": "String Inverter",
  "structureType": "GI Structure",
  "structureSize": "5kW",
  "meterBrand": "Havells",
  "acCableBrand": "Polycab",
  "acCableSize": "6 sq mm",
  "dcCableBrand": "Polycab",
  "dcCableSize": "4 sq mm",
  "acdb": "2-String",
  "dcdb": "2-String"
}
```

This is what appears in the dropdown and pre-fills all form fields.

---

## Database Options

### Option 1: JSON Config Table (Simpler)
```sql
CREATE TABLE pricing_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Store entire pricing tables as JSON in `config_value`.

### Option 2: Normalized Tables (More Flexible)
Separate tables for each pricing category:
- `dcr_pricing`, `non_dcr_pricing`, `both_pricing`
- `panel_pricing`, `inverter_pricing`, `structure_pricing`
- `meter_pricing`, `cable_pricing`
- `acdb_pricing`, `dcdb_pricing`
- `system_config_presets`

---

## Response Format

```json
{
  "success": true,
  "data": {
    "dcr": [...],
    "nonDcr": [...],
    "both": [...],
    "panels": [...],
    "inverters": [...],
    "structures": [...],
    "meters": [...],
    "cables": [...],
    "acdb": [...],
    "dcdb": [...],
    "systemConfigs": [...]  // ← Critical for dropdown
  }
}
```

**Important:** All arrays must be arrays (never `null`). Empty arrays `[]` are acceptable.

---

## Implementation Steps

1. **Create endpoint** `GET /api/quotations/pricing-tables`
2. **Add authentication** (Bearer token required)
3. **Query database** for all pricing data
4. **Format response** to match specification
5. **Seed initial data** (see full spec for complete data)
6. **Test endpoint** returns correct structure

---

## Full Specification

See `BACKEND_PRICING_TABLES_API.md` for:
- Complete data structure definitions
- Database schema details
- Example implementation code
- Testing checklist
- All required fields and types

---

## Frontend Impact

Without this endpoint:
- ❌ Dropdown for pre-configured systems won't work
- ❌ Auto-fill functionality disabled
- ✅ Falls back to hardcoded values (limited functionality)

With this endpoint:
- ✅ Full dropdown functionality
- ✅ All system configurations available
- ✅ Dynamic pricing from backend
- ✅ Easy to update pricing without code changes

---

## Priority

**HIGH** - The product selection form now depends on this endpoint for the dropdown feature.

