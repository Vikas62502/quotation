# Product Catalog Management API - Backend Implementation

**Date:** December 26, 2025  
**Status:** ⚠️ **REQUIRED** - Backend endpoint needs to be implemented  
**Priority:** High - Required for admin product management functionality

---

## Summary

The frontend requires an API endpoint to allow admins to update the product catalog (panel brands, inverter types, sizes, etc.). Currently, the endpoint `PUT /api/config/products` returns a 404 error, indicating it needs to be implemented on the backend.

**Frontend Status:** ✅ Fully implemented and ready  
**Backend Status:** ❌ Endpoint not implemented (returns 404)

---

## Problem

When an admin tries to save product catalog changes in the Admin Panel → Products tab, the following error occurs:

```
PUT http://localhost:3050/api/config/products 404 (Not Found)
```

The frontend is calling `PUT /api/config/products` but this endpoint does not exist on the backend.

---

## Required Endpoint

### PUT /api/config/products

**Purpose:** Allow admin users to update the product catalog configuration.

**Authorization:** Bearer token (admin role required)

**Route:** `PUT /api/config/products`

**Middleware Required:**
- Authentication middleware (verify token)
- Admin role verification (only admin users can update catalog)

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

**Response (400 Bad Request):**
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
      }
    ]
  }
}
```

---

## Implementation Checklist

### Backend Tasks

- [ ] Create database table/model for product catalog configuration (or use JSON storage)
- [ ] Create route handler for `PUT /api/config/products`
- [ ] Add admin role verification middleware
- [ ] Implement validation for product catalog structure
- [ ] Store/update product catalog in database or configuration file
- [ ] Ensure `GET /api/config/products` returns the updated catalog
- [ ] Add error handling for invalid data structures
- [ ] Add logging for catalog updates

### Database Schema (Suggested)

If using a database table:

```sql
CREATE TABLE product_catalog (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- 'panels', 'inverters', 'structures', etc.
  field_name VARCHAR(50) NOT NULL, -- 'brands', 'sizes', 'types', etc.
  values JSONB NOT NULL, -- Array of values
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) -- Admin user ID
);
```

Or use a single JSON configuration:

```sql
CREATE TABLE system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(50) UNIQUE NOT NULL, -- 'product_catalog'
  config_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50)
);
```

### Route Implementation (Example - Node.js/Express)

```typescript
// routes/config.routes.ts or routes/admin.routes.ts
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { ProductCatalog } from '../models/ProductCatalog'; // or your config model

// Option 1: Add to existing config routes
router.put('/products', 
  authenticate, // Verify user is logged in
  requireAdmin, // Verify user is admin (role === 'admin')
  async (req, res) => {
    try {
      const productCatalog = req.body;
      
      // Validate structure
      if (!productCatalog.panels || !productCatalog.inverters) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VAL_001",
            message: "Validation error",
            details: [{
              field: "catalog",
              message: "Invalid product catalog structure"
            }]
          }
        });
      }
      
      // Update product catalog in database
      // Option A: Single JSON field
      await SystemConfig.upsert({
        configKey: 'product_catalog',
        configValue: productCatalog,
        updatedBy: req.user.id, // Admin user ID
        updatedAt: new Date()
      });
      
      // Option B: Separate table entries
      // await ProductCatalog.bulkCreate(productCatalog, {
      //   updateOnDuplicate: ['values', 'updatedAt', 'updatedBy']
      // });
      
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
  }
);
```

### Middleware Implementation

```typescript
// middleware/admin.ts
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTH_003",
        message: "User not authenticated"
      }
    });
  }
  
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
```

### Validation Schema (Example - Zod)

```typescript
import { z } from 'zod';

const productCatalogSchema = z.object({
  panels: z.object({
    brands: z.array(z.string()).min(1),
    sizes: z.array(z.string()).min(1)
  }),
  inverters: z.object({
    types: z.array(z.string()).min(1),
    brands: z.array(z.string()).min(1),
    sizes: z.array(z.string()).min(1)
  }),
  structures: z.object({
    types: z.array(z.string()).min(1),
    sizes: z.array(z.string()).min(1)
  }),
  meters: z.object({
    brands: z.array(z.string()).min(1)
  }),
  cables: z.object({
    brands: z.array(z.string()).min(1),
    sizes: z.array(z.string()).min(1)
  }),
  acdb: z.object({
    options: z.array(z.string()).min(1)
  }),
  dcdb: z.object({
    options: z.array(z.string()).min(1)
  })
});

// Use in route:
const validationResult = productCatalogSchema.safeParse(req.body);
if (!validationResult.success) {
  return res.status(400).json({
    success: false,
    error: {
      code: "VAL_001",
      message: "Validation error",
      details: validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    }
  });
}
```

---

## Frontend Impact

The frontend is already implemented and ready to use this endpoint:

- ✅ `lib/api.ts` - API method `api.adminProducts.updateProducts()` is configured
  - Calls: `PUT /api/config/products`
  - Sends: Complete product catalog JSON structure
  - Requires: Admin authentication token
  
- ✅ `components/admin-product-management.tsx` - Admin UI for managing product catalog
  - Located in: Admin Panel → Products tab
  - Allows: Add/remove items from all categories
  - Shows: Helpful error message if endpoint not implemented
  
- ✅ `lib/use-product-catalog.ts` - Hook to fetch and use product catalog
  - Calls: `GET /api/config/products` (already exists)
  - Falls back: To hardcoded data if API unavailable
  
- ✅ `components/product-selection-form.tsx` - Uses catalog data for dropdowns
  - All dropdowns: Panel brands, sizes, inverter types, brands, sizes, etc.
  - Dynamic: Updates when admin changes catalog

**Current Status:** 
- Frontend: ✅ Fully implemented and ready
- Backend: ❌ `PUT /api/config/products` endpoint needs to be implemented

---

## Testing Checklist

Once implemented, test with:

1. **Admin Login:** Login as admin user (role must be 'admin')
2. **Navigate to Products Tab:** Go to Admin Panel → Products tab
3. **View Current Catalog:** Verify catalog loads from `GET /api/config/products`
4. **Add Item:** Click "Add" button on any category (e.g., add "NewBrand" to Panel Brands)
5. **Remove Item:** Click "X" button to remove an item from any category
6. **Save Changes:** Click "Save Changes" button
7. **Verify Success:** Should see "Product catalog updated successfully!" message
8. **Verify Backend:** Check that `GET /api/config/products` returns updated data
9. **Verify Frontend:** 
   - Navigate to "New Quotation" → Product Selection
   - Verify that new/removed items appear/disappear in dropdowns
10. **Test Non-Admin:** Try to access endpoint as dealer/visitor (should return 403)
11. **Test Unauthenticated:** Try without token (should return 401)

---

## Related Endpoints

- `GET /api/config/products` - ✅ Already exists (returns current catalog)
  - Location: `GET /config/products` in API specification
  - Used by: `lib/use-product-catalog.ts` hook
  - Returns: Complete product catalog structure
  
- `PUT /api/config/products` - ❌ **Needs to be implemented** (updates catalog)
  - Location: Should be added to config routes
  - Used by: `components/admin-product-management.tsx`
  - Requires: Admin authentication
  - Accepts: Complete product catalog structure
  - Returns: Updated product catalog

## Integration Points

### Frontend Files Using This Endpoint

1. **`lib/api.ts`** (Line ~616)
   ```typescript
   adminProducts: {
     updateProducts: async (productData: any) => {
       return apiRequest("/config/products", {
         method: "PUT",
         body: productData,
         requiresAuth: true,
       })
     }
   }
   ```

2. **`components/admin-product-management.tsx`** (Line ~114)
   ```typescript
   await api.adminProducts.updateProducts(editedCatalog)
   ```

3. **`lib/use-product-catalog.ts`** (Line ~30)
   ```typescript
   const response = await api.config.getProducts()
   ```

## Expected Request Format

The frontend sends the following structure:

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

## Implementation Priority

**HIGH** - This endpoint is required for:
- Admin product management functionality
- Dynamic product catalog updates
- Removing dependency on hardcoded product data

---

**Last Updated:** December 26, 2025  
**Frontend Implementation:** ✅ Complete  
**Backend Implementation:** ❌ Pending



