# Backend Implementation Guide: PUT /api/config/products

**Priority:** HIGH  
**Status:** ⚠️ REQUIRED - Frontend is ready, waiting for backend implementation  
**Date:** December 26, 2025

---

## Quick Start

The frontend is calling `PUT /api/config/products` but receiving a 404 error. This endpoint needs to be implemented in your backend server.

**Backend URL:** `http://localhost:3050/api`  
**Endpoint:** `PUT /api/config/products`  
**Required:** Admin authentication (Bearer token with role === 'admin')

---

## Implementation Steps

### Step 1: Choose Your Database Approach

You have two options:

#### Option A: Single JSON Configuration (Recommended)
Store the entire product catalog as a single JSON object in a `system_config` table.

#### Option B: Separate Table Entries
Store each category (panels, inverters, etc.) as separate rows in a `product_catalog` table.

**We recommend Option A** for simplicity and easier updates.

---

## Option A: Single JSON Configuration (Recommended)

### 1. Database Schema

```sql
-- If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

-- Insert initial product catalog (if it doesn't exist)
INSERT INTO system_config (config_key, config_value)
VALUES (
  'product_catalog',
  '{
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
  }'::jsonb
)
ON CONFLICT (config_key) DO NOTHING;
```

### 2. Express.js Route Implementation

**File:** `routes/config.routes.js` or `routes/admin.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const db = require('../db'); // Your database connection

/**
 * PUT /api/config/products
 * Update product catalog (Admin only)
 */
router.put('/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const productCatalog = req.body;
    const userId = req.user.id; // From authentication middleware

    // Basic validation
    if (!productCatalog || typeof productCatalog !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          code: "VAL_001",
          message: "Validation error",
          details: [{
            field: "body",
            message: "Invalid request body"
          }]
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

    // Validate each category structure
    const validationErrors = [];
    
    // Validate panels
    if (!productCatalog.panels.brands || !Array.isArray(productCatalog.panels.brands) || productCatalog.panels.brands.length === 0) {
      validationErrors.push({ field: "panels.brands", message: "At least one panel brand is required" });
    }
    if (!productCatalog.panels.sizes || !Array.isArray(productCatalog.panels.sizes) || productCatalog.panels.sizes.length === 0) {
      validationErrors.push({ field: "panels.sizes", message: "At least one panel size is required" });
    }

    // Validate inverters
    if (!productCatalog.inverters.types || !Array.isArray(productCatalog.inverters.types) || productCatalog.inverters.types.length === 0) {
      validationErrors.push({ field: "inverters.types", message: "At least one inverter type is required" });
    }
    if (!productCatalog.inverters.brands || !Array.isArray(productCatalog.inverters.brands) || productCatalog.inverters.brands.length === 0) {
      validationErrors.push({ field: "inverters.brands", message: "At least one inverter brand is required" });
    }
    if (!productCatalog.inverters.sizes || !Array.isArray(productCatalog.inverters.sizes) || productCatalog.inverters.sizes.length === 0) {
      validationErrors.push({ field: "inverters.sizes", message: "At least one inverter size is required" });
    }

    // Validate structures
    if (!productCatalog.structures.types || !Array.isArray(productCatalog.structures.types) || productCatalog.structures.types.length === 0) {
      validationErrors.push({ field: "structures.types", message: "At least one structure type is required" });
    }
    if (!productCatalog.structures.sizes || !Array.isArray(productCatalog.structures.sizes) || productCatalog.structures.sizes.length === 0) {
      validationErrors.push({ field: "structures.sizes", message: "At least one structure size is required" });
    }

    // Validate meters
    if (!productCatalog.meters.brands || !Array.isArray(productCatalog.meters.brands) || productCatalog.meters.brands.length === 0) {
      validationErrors.push({ field: "meters.brands", message: "At least one meter brand is required" });
    }

    // Validate cables
    if (!productCatalog.cables.brands || !Array.isArray(productCatalog.cables.brands) || productCatalog.cables.brands.length === 0) {
      validationErrors.push({ field: "cables.brands", message: "At least one cable brand is required" });
    }
    if (!productCatalog.cables.sizes || !Array.isArray(productCatalog.cables.sizes) || productCatalog.cables.sizes.length === 0) {
      validationErrors.push({ field: "cables.sizes", message: "At least one cable size is required" });
    }

    // Validate acdb
    if (!productCatalog.acdb.options || !Array.isArray(productCatalog.acdb.options) || productCatalog.acdb.options.length === 0) {
      validationErrors.push({ field: "acdb.options", message: "At least one ACDB option is required" });
    }

    // Validate dcdb
    if (!productCatalog.dcdb.options || !Array.isArray(productCatalog.dcdb.options) || productCatalog.dcdb.options.length === 0) {
      validationErrors.push({ field: "dcdb.options", message: "At least one DCDB option is required" });
    }

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

    // Update or insert product catalog
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

    const result = await db.query(query, [
      'product_catalog',
      JSON.stringify(productCatalog),
      userId
    ]);

    // Log the update
    console.log(`Product catalog updated by user ${userId} at ${new Date().toISOString()}`);

    // Return success response
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

### 3. Admin Middleware

**File:** `middleware/admin.js`

```javascript
/**
 * Middleware to require admin role
 */
const requireAdmin = (req, res, next) => {
  // Check if user is authenticated (should be set by authenticate middleware)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTH_003",
        message: "User not authenticated"
      }
    });
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: "AUTH_004",
        message: "Insufficient permissions. Admin access required."
      }
    });
  }

  next();
};

module.exports = { requireAdmin };
```

### 4. Register the Route

**File:** `app.js` or `server.js` or `index.js`

```javascript
const express = require('express');
const configRoutes = require('./routes/config.routes');
// ... other imports

const app = express();

// ... other middleware

// Register config routes
app.use('/api/config', configRoutes);

// ... rest of your app setup
```

---

## Option B: Separate Table Entries

If you prefer to store each category separately:

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS product_catalog (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  values JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, field_name)
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON product_catalog(category);
```

### Route Implementation

```javascript
router.put('/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const productCatalog = req.body;
    const userId = req.user.id;

    // Validation (same as Option A)

    // Update each category
    const updates = [];

    // Update panels
    updates.push(
      db.query(
        'INSERT INTO product_catalog (category, field_name, values, updated_by) VALUES ($1, $2, $3, $4) ON CONFLICT (category, field_name) DO UPDATE SET values = EXCLUDED.values, updated_by = EXCLUDED.updated_by, updated_at = NOW()',
        ['panels', 'brands', JSON.stringify(productCatalog.panels.brands), userId]
      ),
      db.query(
        'INSERT INTO product_catalog (category, field_name, values, updated_by) VALUES ($1, $2, $3, $4) ON CONFLICT (category, field_name) DO UPDATE SET values = EXCLUDED.values, updated_by = EXCLUDED.updated_by, updated_at = NOW()',
        ['panels', 'sizes', JSON.stringify(productCatalog.panels.sizes), userId]
      )
    );

    // Update inverters
    updates.push(
      db.query(/* ... */),
      // ... etc
    );

    await Promise.all(updates);

    res.json({
      success: true,
      message: "Product catalog updated successfully",
      data: productCatalog
    });
  } catch (error) {
    // Error handling
  }
});
```

---

## Testing

### 1. Test with cURL

```bash
# Get auth token first (login as admin)
TOKEN="your-admin-token-here"

# Update product catalog
curl -X PUT http://localhost:3050/api/config/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "panels": {
      "brands": ["Adani", "Tata", "Waaree", "Vikram Solar", "RenewSys", "NewBrand"],
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
  }'
```

### 2. Test Error Cases

```bash
# Test without authentication (should return 401)
curl -X PUT http://localhost:3050/api/config/products \
  -H "Content-Type: application/json" \
  -d '{"panels": {"brands": ["Test"]}}'

# Test with non-admin user (should return 403)
curl -X PUT http://localhost:3050/api/config/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEALER_TOKEN" \
  -d '{"panels": {"brands": ["Test"]}}'

# Test with invalid data (should return 400)
curl -X PUT http://localhost:3050/api/config/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"panels": {}}'
```

---

## Integration with Existing GET Endpoint

Make sure your existing `GET /api/config/products` endpoint returns data in the same format:

```javascript
router.get('/products', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT config_value FROM system_config WHERE config_key = $1',
      ['product_catalog']
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          // Return default catalog structure
          panels: { brands: [], sizes: [] },
          inverters: { types: [], brands: [], sizes: [] },
          // ... etc
        }
      });
    }

    res.json({
      success: true,
      data: result.rows[0].config_value
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SYS_001", message: "Internal server error" }
    });
  }
});
```

---

## Important Notes

1. **Authentication:** The endpoint MUST verify the user is authenticated and has admin role
2. **Validation:** Validate all required fields before saving
3. **Error Responses:** Use the exact error format shown above (matches frontend expectations)
4. **Success Response:** Return the updated catalog in the `data` field
5. **Logging:** Log catalog updates for audit purposes

---

## Frontend Integration

Once implemented, the frontend will automatically:
- ✅ Save product catalog changes from Admin Panel → Products tab
- ✅ Display success/error messages
- ✅ Update dropdowns in the product selection form
- ✅ Persist changes across sessions

**No frontend changes needed** - it's already fully implemented and waiting for this endpoint!

---

## Support

If you need help implementing this:
1. Check `BACKEND_PRODUCT_CATALOG_API.md` for detailed API specification
2. Review the frontend code in `components/admin-product-management.tsx` to see what data format is sent
3. Test with the frontend UI after implementation

---

**Last Updated:** December 26, 2025


