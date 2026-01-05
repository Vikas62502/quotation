# API Endpoint Specification: Product Catalog Management

**Priority:** HIGH  
**Status:** ⚠️ REQUIRED - Frontend is ready and depends on this API  
**Date:** December 26, 2025

---

## Overview

The frontend has been updated to use **only API data** (no dummy data fallbacks). The backend must implement the Product Catalog API endpoints to provide product data to the frontend.

---

## Required Endpoints

### 1. GET /api/config/products

**Purpose:** Fetch the complete product catalog (Admin management)

**Method:** `GET`

**Authentication:** Required (Bearer token)

**Authorization:** Any authenticated user

---

### 2. GET /api/quotations/product-catalog

**Purpose:** Fetch the complete product catalog (For quotation product selection forms)

**Method:** `GET`

**Authentication:** Required (Bearer token)

**Authorization:** Dealers, Admins, and Visitors

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "panels": {
      "brands": ["Adani", "Tata", "Waaree", "Vikram Solar", "RenewSys"],
      "sizes": ["440W", "445W", "540W", "545W", "550W", "555W"]
    },
    "inverters": {
      "types": ["String Inverter", "Micro Inverter", "Hybrid Inverter"],
      "brands": ["Growatt", "Solis", "Fronius", "Havells", "Polycab", "Delta"],
      "sizes": ["3kW", "5kW", "6kW", "8kW", "10kW", "15kW", "20kW", "25kW"]
    },
    "structures": {
      "types": ["GI Structure", "Aluminum Structure", "MS Structure"],
      "sizes": ["1kW", "2kW", "3kW", "5kW", "10kW", "15kW", "20kW"]
    },
    "meters": {
      "brands": ["L&T", "HPL", "Havells", "Genus", "Secure"]
    },
    "cables": {
      "brands": ["Polycab", "Havells", "KEI", "Finolex", "RR Kabel"],
      "sizes": ["4 sq mm", "6 sq mm", "10 sq mm", "16 sq mm", "25 sq mm"]
    },
    "acdb": {
      "options": ["1-String", "2-String", "3-String", "4-String"]
    },
    "dcdb": {
      "options": ["1-String", "2-String", "3-String", "4-String", "5-String"]
    }
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "User not authenticated"
  }
}
```

**Response (500 Internal Server Error):**
```json
{
  "success": false,
  "error": {
    "code": "SYS_001",
    "message": "Internal server error"
  }
}
```

**Notes:**
- ⚠️ This endpoint needs to be implemented
- Must return data in the exact structure shown above
- All arrays must be arrays (never `null` or `undefined`)
- Arrays can be empty `[]` if no data exists
- Returns the same data as `/api/config/products` but accessible to dealers and visitors

---

### 3. GET /api/config/products (Admin)

**Purpose:** Fetch the complete product catalog (Admin management)

**Method:** `GET`

**Authentication:** Required (Bearer token)

**Authorization:** Any authenticated user

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "panels": {
      "brands": ["Adani", "Tata", "Waaree", "Vikram Solar", "RenewSys"],
      "sizes": ["440W", "445W", "540W", "545W", "550W", "555W"]
    },
    "inverters": {
      "types": ["String Inverter", "Micro Inverter", "Hybrid Inverter"],
      "brands": ["Growatt", "Solis", "Fronius", "Havells", "Polycab", "Delta"],
      "sizes": ["3kW", "5kW", "6kW", "8kW", "10kW", "15kW", "20kW", "25kW"]
    },
    "structures": {
      "types": ["GI Structure", "Aluminum Structure", "MS Structure"],
      "sizes": ["1kW", "2kW", "3kW", "5kW", "10kW", "15kW", "20kW"]
    },
    "meters": {
      "brands": ["L&T", "HPL", "Havells", "Genus", "Secure"]
    },
    "cables": {
      "brands": ["Polycab", "Havells", "KEI", "Finolex", "RR Kabel"],
      "sizes": ["4 sq mm", "6 sq mm", "10 sq mm", "16 sq mm", "25 sq mm"]
    },
    "acdb": {
      "options": ["1-String", "2-String", "3-String", "4-String"]
    },
    "dcdb": {
      "options": ["1-String", "2-String", "3-String", "4-String", "5-String"]
    }
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "User not authenticated"
  }
}
```

**Response (500 Internal Server Error):**
```json
{
  "success": false,
  "error": {
    "code": "SYS_001",
    "message": "Internal server error"
  }
}
```

**Notes:**
- ✅ This endpoint may already exist
- Must return data in the exact structure shown above
- All arrays must be arrays (never `null` or `undefined`)
- Arrays can be empty `[]` if no data exists

---

### 4. PUT /api/config/products

**Purpose:** Update the product catalog (Admin only)

**Method:** `PUT`

**Authentication:** Required (Bearer token)

**Authorization:** Admin role required (`role === 'admin'`)

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "panels": {
    "brands": ["Adani", "Tata", "Waaree", "Vikram Solar", "RenewSys"],
    "sizes": ["440W", "445W", "540W", "545W", "550W", "555W"]
  },
  "inverters": {
    "types": ["String Inverter", "Micro Inverter", "Hybrid Inverter"],
    "brands": ["Growatt", "Solis", "Fronius", "Havells", "Polycab", "Delta"],
    "sizes": ["3kW", "5kW", "6kW", "8kW", "10kW", "15kW", "20kW", "25kW"]
  },
  "structures": {
    "types": ["GI Structure", "Aluminum Structure", "MS Structure"],
    "sizes": ["1kW", "2kW", "3kW", "5kW", "10kW", "15kW", "20kW"]
  },
  "meters": {
    "brands": ["L&T", "HPL", "Havells", "Genus", "Secure"]
  },
  "cables": {
    "brands": ["Polycab", "Havells", "KEI", "Finolex", "RR Kabel"],
    "sizes": ["4 sq mm", "6 sq mm", "10 sq mm", "16 sq mm", "25 sq mm"]
  },
  "acdb": {
    "options": ["1-String", "2-String", "3-String", "4-String"]
  },
  "dcdb": {
    "options": ["1-String", "2-String", "3-String", "4-String", "5-String"]
  }
}
```

**Validation Requirements:**

1. **Structure Validation:**
   - Request body must be an object
   - All required categories must exist: `panels`, `inverters`, `structures`, `meters`, `cables`, `acdb`, `dcdb`

2. **Type Validation:**
   - All fields must be arrays (not `null`, `undefined`, or other types)
   - Each array item must be a non-empty string

3. **Content Validation:**
   - Each array must have at least one item (non-empty arrays)
   - Array items must be non-empty strings

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Product catalog updated successfully",
  "data": {
    "panels": {
      "brands": ["Adani", "Tata", "Waaree", "Vikram Solar", "RenewSys"],
      "sizes": ["440W", "445W", "540W", "545W", "550W", "555W"]
    },
    "inverters": {
      "types": ["String Inverter", "Micro Inverter", "Hybrid Inverter"],
      "brands": ["Growatt", "Solis", "Fronius", "Havells", "Polycab", "Delta"],
      "sizes": ["3kW", "5kW", "6kW", "8kW", "10kW", "15kW", "20kW", "25kW"]
    },
    "structures": {
      "types": ["GI Structure", "Aluminum Structure", "MS Structure"],
      "sizes": ["1kW", "2kW", "3kW", "5kW", "10kW", "15kW", "20kW"]
    },
    "meters": {
      "brands": ["L&T", "HPL", "Havells", "Genus", "Secure"]
    },
    "cables": {
      "brands": ["Polycab", "Havells", "KEI", "Finolex", "RR Kabel"],
      "sizes": ["4 sq mm", "6 sq mm", "10 sq mm", "16 sq mm", "25 sq mm"]
    },
    "acdb": {
      "options": ["1-String", "2-String", "3-String", "4-String"]
    },
    "dcdb": {
      "options": ["1-String", "2-String", "3-String", "4-String", "5-String"]
    }
  }
}
```

**Response (400 Bad Request - Validation Error):**
```json
{
  "success": false,
  "error": {
    "code": "VAL_001",
    "message": "Validation error",
    "details": [
      {
        "field": "panels.brands",
        "message": "At least one panel brand is required"
      },
      {
        "field": "inverters.types",
        "message": "At least one inverter type is required"
      }
    ]
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "User not authenticated"
  }
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Insufficient permissions. Admin access required."
  }
}
```

**Response (500 Internal Server Error):**
```json
{
  "success": false,
  "error": {
    "code": "SYS_001",
    "message": "Internal server error"
  }
}
```

---

## Database Schema

### Recommended: Single JSON Configuration Table

```sql
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
```

**Usage:**
- `config_key`: `'product_catalog'`
- `config_value`: Complete product catalog JSON object (as shown in request/response)

---

## Implementation Checklist

### GET /api/config/products (Admin Management)

- [ ] Route handler created
- [ ] Authentication middleware applied
- [ ] Database query to fetch product catalog
- [ ] Response format matches specification
- [ ] Error handling implemented
- [ ] Returns empty arrays if no data exists (never `null` or `undefined`)

### GET /api/quotations/product-catalog (Product Selection) ⚠️ CRITICAL

- [ ] Route handler created
- [ ] Authentication middleware applied
- [ ] Authorization: Allow dealers, admins, and visitors
- [ ] Database query to fetch product catalog (same data as `/api/config/products`)
- [ ] Response format matches specification
- [ ] Error handling implemented
- [ ] Returns empty arrays if no data exists (never `null` or `undefined`)
- [ ] **CRITICAL:** Frontend product selection form depends on this endpoint

### PUT /api/config/products

- [ ] Route handler created
- [ ] Authentication middleware applied
- [ ] Admin role verification middleware applied
- [ ] Request body validation implemented
- [ ] Structure validation (all categories exist)
- [ ] Type validation (all fields are arrays)
- [ ] Content validation (non-empty arrays)
- [ ] Database update/insert implemented
- [ ] Response format matches specification
- [ ] Error handling for all error cases
- [ ] Logging for audit purposes

### Database

- [ ] `system_config` table created
- [ ] Initial product catalog data inserted (or seed script ready)
- [ ] Indexes created for performance

### Testing

- [ ] GET endpoint returns correct data structure
- [ ] GET endpoint handles missing data gracefully
- [ ] PUT endpoint accepts valid data
- [ ] PUT endpoint rejects invalid data
- [ ] PUT endpoint requires authentication
- [ ] PUT endpoint requires admin role
- [ ] PUT endpoint updates database correctly
- [ ] GET endpoint returns updated data after PUT
- [ ] Error responses match specification

---

## Implementation Priority

**CRITICAL** - Frontend is completely dependent on these endpoints:

1. **GET /api/quotations/product-catalog** - **CRITICAL** - Without this, product selection form will have empty dropdowns (used by dealers, admins, and visitors)
2. **GET /api/config/products** - For admin management UI
3. **PUT /api/config/products** - Without this, admin cannot manage product catalog

---

## Frontend Integration

### Files Using These Endpoints

1. **`lib/use-product-catalog.ts`**
   - Calls: `GET /api/quotations/product-catalog` ⚠️ **CRITICAL**
   - Used by: All components that need product data (product selection form)
   - Impact: If endpoint fails, dropdowns will be empty

2. **`components/admin-product-management.tsx`**
   - Calls: `GET /api/config/products` (for loading catalog)
   - Calls: `PUT /api/config/products` (for updating catalog)
   - Used by: Admin Panel → Products tab
   - Impact: If endpoints not implemented, admin cannot manage catalog

3. **`components/product-selection-form.tsx`**
   - Uses: Data from `useProductCatalog()` hook
   - Hook calls: `GET /api/quotations/product-catalog` ⚠️ **CRITICAL**
   - Impact: All product selection dropdowns depend on this endpoint

### Data Flow

```
1. Product Selection Form loads → GET /api/quotations/product-catalog → Populates dropdowns
2. Admin Panel loads → GET /api/config/products → Shows catalog for editing
3. Admin updates catalog → PUT /api/config/products → Updates database
4. Product Selection Form reloads → GET /api/quotations/product-catalog → Gets updated data
```

---

## Example Implementation (Node.js/Express)

### Route File: `routes/config.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const db = require('../db');

// Helper function to fetch product catalog from database
const getProductCatalogFromDB = async () => {
  const result = await db.query(
    'SELECT config_value FROM system_config WHERE config_key = $1',
    ['product_catalog']
  );

  if (result.rows.length === 0) {
    // Return empty catalog structure if no data exists
    return {
      panels: { brands: [], sizes: [] },
      inverters: { types: [], brands: [], sizes: [] },
      structures: { types: [], sizes: [] },
      meters: { brands: [] },
      cables: { brands: [], sizes: [] },
      acdb: { options: [] },
      dcdb: { options: [] }
    };
  }

  return result.rows[0].config_value;
};

// GET /api/config/products (Admin management)
router.get('/products', authenticate, async (req, res) => {
  try {
    const catalogData = await getProductCatalogFromDB();
    res.json({
      success: true,
      data: catalogData
    });
  } catch (error) {
    console.error('Error fetching product catalog:', error);
    res.status(500).json({
      success: false,
      error: {
        code: "SYS_001",
        message: "Internal server error"
      }
    });
  }
});

// PUT /api/config/products
router.put('/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const productCatalog = req.body;
    const userId = req.user.id;

    // Validation
    const validationErrors = [];

    // Helper to validate array field
    const validateArray = (path, value, fieldName) => {
      if (!Array.isArray(value)) {
        validationErrors.push({
          field: path,
          message: `${fieldName} must be an array`
        });
        return false;
      }
      if (value.length === 0) {
        validationErrors.push({
          field: path,
          message: `At least one ${fieldName.toLowerCase()} is required`
        });
        return false;
      }
      return true;
    };

    // Validate structure
    if (!productCatalog || typeof productCatalog !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          code: "VAL_001",
          message: "Validation error",
          details: [{ field: "body", message: "Invalid request body" }]
        }
      });
    }

    // Validate required categories
    const requiredCategories = ['panels', 'inverters', 'structures', 'meters', 'cables', 'acdb', 'dcdb'];
    const missingCategories = requiredCategories.filter(cat => !productCatalog[cat]);
    
    if (missingCategories.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VAL_001",
          message: "Validation error",
          details: missingCategories.map(cat => ({
            field: cat,
            message: `Missing required category: ${cat}`
          }))
        }
      });
    }

    // Validate all fields
    validateArray('panels.brands', productCatalog.panels?.brands, 'Panel brands');
    validateArray('panels.sizes', productCatalog.panels?.sizes, 'Panel sizes');
    validateArray('inverters.types', productCatalog.inverters?.types, 'Inverter types');
    validateArray('inverters.brands', productCatalog.inverters?.brands, 'Inverter brands');
    validateArray('inverters.sizes', productCatalog.inverters?.sizes, 'Inverter sizes');
    validateArray('structures.types', productCatalog.structures?.types, 'Structure types');
    validateArray('structures.sizes', productCatalog.structures?.sizes, 'Structure sizes');
    validateArray('meters.brands', productCatalog.meters?.brands, 'Meter brands');
    validateArray('cables.brands', productCatalog.cables?.brands, 'Cable brands');
    validateArray('cables.sizes', productCatalog.cables?.sizes, 'Cable sizes');
    validateArray('acdb.options', productCatalog.acdb?.options, 'ACDB options');
    validateArray('dcdb.options', productCatalog.dcdb?.options, 'DCDB options');

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VAL_001",
          message: "Validation error",
          details: validationErrors
        }
      });
    }

    // Update database
    const query = `
      INSERT INTO system_config (config_key, config_value, updated_by, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (config_key)
      DO UPDATE SET
        config_value = EXCLUDED.config_value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING config_value;
    `;

    await db.query(query, [
      'product_catalog',
      JSON.stringify(productCatalog),
      userId
    ]);

    console.log(`Product catalog updated by user ${userId} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: "Product catalog updated successfully",
      data: productCatalog
    });

  } catch (error) {
    console.error('Error updating product catalog:', error);
    res.status(500).json({
      success: false,
      error: {
        code: "SYS_001",
        message: "Internal server error"
      }
    });
  }
});

module.exports = router;
```

### Route File: `routes/quotations.routes.js` (or add to existing quotations routes)

```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../db');

// Helper function to fetch product catalog from database (same as config routes)
const getProductCatalogFromDB = async () => {
  const result = await db.query(
    'SELECT config_value FROM system_config WHERE config_key = $1',
    ['product_catalog']
  );

  if (result.rows.length === 0) {
    return {
      panels: { brands: [], sizes: [] },
      inverters: { types: [], brands: [], sizes: [] },
      structures: { types: [], sizes: [] },
      meters: { brands: [] },
      cables: { brands: [], sizes: [] },
      acdb: { options: [] },
      dcdb: { options: [] }
    };
  }

  return result.rows[0].config_value;
};

// GET /api/quotations/product-catalog (For product selection forms)
// ⚠️ CRITICAL: Frontend product selection form depends on this endpoint
router.get('/product-catalog', authenticate, async (req, res) => {
  try {
    const catalogData = await getProductCatalogFromDB();
    res.json({
      success: true,
      data: catalogData
    });
  } catch (error) {
    console.error('Error fetching product catalog:', error);
    res.status(500).json({
      success: false,
      error: {
        code: "SYS_001",
        message: "Internal server error"
      }
    });
  }
});

module.exports = router;
```

---

## Testing with cURL

### Test GET /api/config/products (Admin)

```bash
TOKEN="your-auth-token"

curl -X GET http:///api/config/products \
  -H "Authorization: Bearer $TOKEN"
```

### Test GET /api/quotations/product-catalog (Product Selection) ⚠️ CRITICAL

```bash
TOKEN="your-auth-token"

curl -X GET http://localhost:3050/api/quotations/product-catalog \
  -H "Authorization: Bearer $TOKEN"
```

### Test PUT endpoint

```bash
TOKEN="your-admin-token"

curl -X PUT http://localhost:3050/api/config/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "panels": {
      "brands": ["Adani", "Tata", "Waaree"],
      "sizes": ["440W", "445W", "540W", "545W"]
    },
    "inverters": {
      "types": ["String Inverter", "Micro Inverter", "Hybrid Inverter"],
      "brands": ["Growatt", "Solis", "Fronius"],
      "sizes": ["3kW", "5kW", "6kW", "8kW", "10kW"]
    },
    "structures": {
      "types": ["GI Structure", "Aluminum Structure"],
      "sizes": ["1kW", "2kW", "3kW", "5kW"]
    },
    "meters": {
      "brands": ["L&T", "HPL", "Havells"]
    },
    "cables": {
      "brands": ["Polycab", "Havells", "KEI"],
      "sizes": ["4 sq mm", "6 sq mm", "10 sq mm"]
    },
    "acdb": {
      "options": ["1-String", "2-String", "3-String"]
    },
    "dcdb": {
      "options": ["1-String", "2-String", "3-String", "4-String"]
    }
  }'
```

---

## Important Notes

1. **Frontend Dependency:** Frontend has **no fallback data**. If API fails, dropdowns will be empty.

2. **Data Format:** All fields must be arrays. Never return `null` or `undefined` for array fields.

3. **Error Codes:** Use exact error codes specified:
   - `AUTH_003`: Not authenticated
   - `AUTH_004`: Insufficient permissions (not admin)
   - `VAL_001`: Validation error
   - `SYS_001`: Internal server error

4. **Response Structure:** Always use this format:
   ```json
   {
     "success": true|false,
     "data": {...},  // for success
     "error": {...}  // for errors
   }
   ```

5. **Admin Only:** PUT endpoint must verify user has admin role.

---

---

## Troubleshooting: Data Not Showing in UI

If Panel Brand, Panel Size, and other dropdowns are empty:

1. **Check if endpoint exists:**
   - Verify `GET /api/quotations/product-catalog` endpoint is implemented
   - Check browser console for 404 errors

2. **Check API response:**
   - Open browser DevTools → Network tab
   - Look for request to `/api/quotations/product-catalog`
   - Verify response format matches specification

3. **Check console logs:**
   - Frontend logs: "Product catalog API response:" - check what's returned
   - Look for error messages in console

4. **Verify authentication:**
   - Ensure user is logged in
   - Check that Bearer token is being sent

5. **Response format must be:**
   ```json
   {
     "success": true,
     "data": {
       "panels": { "brands": [...], "sizes": [...] },
       ...
     }
   }
   ```

---

**Last Updated:** December 26, 2025  
**Frontend Status:** ✅ Ready (depends on these endpoints)  
**Backend Status:** ⚠️ Implementation Required


