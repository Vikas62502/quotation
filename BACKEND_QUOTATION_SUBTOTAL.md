# Backend Requirement: Save Subtotal to Database

**Priority:** HIGH  
**Status:** ⚠️ REQUIRED - Frontend now sends subtotal  
**Date:** December 30, 2025

---

## Overview

The frontend now sends the **subtotal** (total project cost before subsidies) when creating a quotation. The backend must save this value to the database.

---

## Updated Request Body for POST /api/quotations

When creating a quotation, the frontend now sends:

```json
{
  "customerId": "customer-123",
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "mobile": "9876543210",
    "email": "john@example.com",
    "address": {
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    }
  },
  "products": {
    "systemType": "dcr",
    "panelBrand": "Adani",
    "panelSize": "545W",
    "panelQuantity": 6,
    // ... other product fields
  },
  "discount": 5,
  "subtotal": 185000,  // ← NEW: Total project cost (before subsidies)
  "totalSubsidy": 78000,  // ← NEW: Central + State subsidy
  "amountAfterSubsidy": 107000,  // ← NEW: Subtotal - Total Subsidy
  "discountAmount": 5350,  // ← NEW: Discount amount
  "totalAmount": 185000,  // ← For backward compatibility (same as subtotal)
  "finalAmount": 101650  // ← NEW: Final amount after all deductions
}
```

---

## Field Definitions

### `subtotal` (REQUIRED)
- **Type:** `number`
- **Description:** Total project cost before any subsidies or discounts
- **Calculation:**
  - For DCR/NON DCR/BOTH: Set price from pricing table (complete package price)
  - For CUSTOMIZE: Sum of all individual component prices
- **Example:** `185000` (for DCR 3kW Adani system)

### `totalSubsidy` (REQUIRED)
- **Type:** `number`
- **Description:** Sum of central subsidy + state subsidy
- **Calculation:** `(centralSubsidy || 0) + (stateSubsidy || 0)`
- **Example:** `78000`

### `amountAfterSubsidy` (REQUIRED)
- **Type:** `number`
- **Description:** Amount after applying subsidies
- **Calculation:** `subtotal - totalSubsidy`
- **Example:** `107000`

### `discountAmount` (REQUIRED)
- **Type:** `number`
- **Description:** Discount amount calculated from amount after subsidy
- **Calculation:** `amountAfterSubsidy * (discount / 100)`
- **Example:** `5350` (5% of 107000)

### `finalAmount` (REQUIRED)
- **Type:** `number`
- **Description:** Final amount after all deductions
- **Calculation:** `amountAfterSubsidy - discountAmount`
- **Example:** `101650`

### `totalAmount` (For backward compatibility)
- **Type:** `number`
- **Description:** Same as `subtotal` (total project cost)
- **Note:** Kept for backward compatibility, but `subtotal` is the preferred field name

---

## Database Schema Update

The quotations table should store:

```sql
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS total_subsidy DECIMAL(12,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS amount_after_subsidy DECIMAL(12,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS final_amount DECIMAL(12,2);
```

Or if using a pricing JSONB column:

```sql
-- If using pricing JSONB column
UPDATE quotations 
SET pricing = jsonb_build_object(
  'subtotal', $1,
  'totalSubsidy', $2,
  'amountAfterSubsidy', $3,
  'discountAmount', $4,
  'finalAmount', $5,
  'totalAmount', $1  -- For backward compatibility
)
WHERE id = $6;
```

---

## Backend Implementation

### Example (Node.js/Express)

```javascript
// POST /api/quotations
router.post('/quotations', authenticate, async (req, res) => {
  try {
    const {
      customerId,
      customer,
      products,
      discount,
      subtotal,           // ← NEW: Must save this
      totalSubsidy,       // ← NEW
      amountAfterSubsidy, // ← NEW
      discountAmount,     // ← NEW
      totalAmount,        // ← For backward compatibility
      finalAmount         // ← NEW
    } = req.body;

    // Validate required fields
    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_001',
          message: 'Subtotal is required and must be greater than 0'
        }
      });
    }

    // Create quotation in database
    const quotation = await db.query(
      `INSERT INTO quotations (
        customer_id,
        dealer_id,
        products,
        discount,
        subtotal,              -- ← Save subtotal
        total_subsidy,         -- ← Save total subsidy
        amount_after_subsidy,  -- ← Save amount after subsidy
        discount_amount,       -- ← Save discount amount
        total_amount,          -- ← Save total amount (same as subtotal)
        final_amount,          -- ← Save final amount
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        customerId,
        req.user.id, // dealer ID from auth
        JSON.stringify(products),
        discount,
        subtotal,
        totalSubsidy || 0,
        amountAfterSubsidy || subtotal,
        discountAmount || 0,
        totalAmount || subtotal,
        finalAmount || subtotal
      ]
    );

    res.json({
      success: true,
      data: {
        id: quotation.rows[0].id,
        customer,
        products,
        discount,
        pricing: {
          subtotal: quotation.rows[0].subtotal,
          totalSubsidy: quotation.rows[0].total_subsidy,
          amountAfterSubsidy: quotation.rows[0].amount_after_subsidy,
          discountAmount: quotation.rows[0].discount_amount,
          totalAmount: quotation.rows[0].total_amount,
          finalAmount: quotation.rows[0].final_amount
        },
        createdAt: quotation.rows[0].created_at,
        dealerId: quotation.rows[0].dealer_id,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error creating quotation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYS_001',
        message: 'Internal server error'
      }
    });
  }
});
```

---

## Response Format

The backend should return the quotation with pricing details:

```json
{
  "success": true,
  "data": {
    "id": "QT-12345",
    "customer": { ... },
    "products": { ... },
    "discount": 5,
    "pricing": {
      "subtotal": 185000,
      "totalSubsidy": 78000,
      "amountAfterSubsidy": 107000,
      "discountAmount": 5350,
      "totalAmount": 185000,
      "finalAmount": 101650
    },
    "createdAt": "2025-12-30T10:00:00Z",
    "dealerId": "dealer-123",
    "status": "pending"
  }
}
```

---

## Important Notes

1. **Subtotal is the Primary Field**: The `subtotal` field represents the total project cost (complete package price for DCR/NON DCR/BOTH, or sum of components for CUSTOMIZE).

2. **Backward Compatibility**: The `totalAmount` field is still sent for backward compatibility, but `subtotal` is the preferred field name.

3. **All Pricing Fields Required**: The frontend now sends all pricing breakdown fields. The backend should save all of them for complete pricing transparency.

4. **Validation**: The backend should validate that:
   - `subtotal > 0`
   - `totalSubsidy >= 0`
   - `amountAfterSubsidy = subtotal - totalSubsidy`
   - `discountAmount = amountAfterSubsidy * (discount / 100)`
   - `finalAmount = amountAfterSubsidy - discountAmount`

---

## Frontend Changes

The frontend has been updated in:
- `lib/quotation-context.tsx` - `saveQuotation` function now sends all pricing fields
- `components/quotation-confirmation.tsx` - Calculates and passes subtotal to `saveQuotation`

---

## Priority

**HIGH** - The frontend is now sending the subtotal. The backend must save it to the database to maintain pricing accuracy and enable proper quotation tracking.



