# Backend Fix: Subtotal and FinalAmount Not Saving to Database

**Priority:** HIGH  
**Status:** 🔴 CRITICAL - Data not being saved  
**Date:** Current

---

## Problem

When creating a quotation, the frontend sends `subtotal` and `finalAmount` in the request, but these values are **not being saved to the database**.

---

## What Frontend Sends

The frontend sends the following pricing fields in the POST `/api/quotations` request:

```json
{
  "customerId": "customer-123",
  "customer": { ... },
  "products": { ... },
  "discount": 5,
  "subtotal": 300000,           // ← MUST BE SAVED (Set price - complete package price)
  "centralSubsidy": 78000,
  "stateSubsidy": 17000,
  "totalSubsidy": 95000,
  "amountAfterSubsidy": 205000,
  "discountAmount": 10250,
  "totalAmount": 194750,        // ← MUST BE SAVED (Amount after discount)
  "finalAmount": 205000         // ← MUST BE SAVED (Subtotal - Subsidy, discount NOT applied)
}
```

---

## Required Database Fields

The backend **MUST** save these fields to the database:

1. **`subtotal`** → Database column: `subtotal` (DECIMAL)
   - Set price (complete package price)
   - Example: `300000`

2. **`totalAmount`** → Database column: `total_amount` (DECIMAL)
   - Amount after discount (Subtotal - Subsidy - Discount)
   - Example: `194750`

3. **`finalAmount`** → Database column: `final_amount` (DECIMAL)
   - Final amount (Subtotal - Subsidy, discount NOT applied)
   - Example: `205000`

4. **Additional Fields** (Recommended):
   - `central_subsidy` (DECIMAL) - Central government subsidy
   - `state_subsidy` (DECIMAL) - State subsidy
   - `total_subsidy` (DECIMAL) - Total subsidy (central + state)
   - `amount_after_subsidy` (DECIMAL) - Amount after subsidy
   - `discount_amount` (DECIMAL) - Discount amount

---

## Database Schema

Ensure these columns exist in the `quotations` table:

```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quotations' 
AND column_name IN ('subtotal', 'total_amount', 'final_amount', 'central_subsidy', 'state_subsidy');

-- If missing, add them:
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS central_subsidy DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS state_subsidy DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS total_subsidy DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS amount_after_subsidy DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS final_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
```

---

## Backend Implementation Fix

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
      subtotal,        // ← MUST extract this (set price)
      centralSubsidy,  // ← Individual central subsidy
      stateSubsidy,    // ← Individual state subsidy
      totalSubsidy,    // ← Total subsidy (central + state)
      amountAfterSubsidy,
      discountAmount,
      totalAmount,     // ← MUST extract this (amount after discount)
      finalAmount      // ← MUST extract this (subtotal - subsidy)
    } = req.body;

    // Validate required pricing fields
    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_001',
          message: 'Subtotal is required and must be greater than 0',
          details: [{
            field: 'subtotal',
            message: `Subtotal must be greater than 0. Please provide 'subtotal' in the request body. Current value: ${subtotal}`
          }]
        }
      });
    }

    if (totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_002',
          message: 'Total amount is required'
        }
      });
    }

    if (finalAmount === undefined || finalAmount === null) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_003',
          message: 'Final amount is required'
        }
      });
    }

    // Create quotation - MUST save subtotal, totalAmount, and finalAmount
    const quotation = await db.query(
      `INSERT INTO quotations (
        customer_id,
        dealer_id,
        products,
        discount,
        subtotal,              -- ← MUST SAVE THIS (set price)
        central_subsidy,       -- ← Save central subsidy
        state_subsidy,         -- ← Save state subsidy
        total_subsidy,         -- ← Save total subsidy
        amount_after_subsidy,
        discount_amount,
        total_amount,          -- ← MUST SAVE THIS (amount after discount)
        final_amount,          -- ← MUST SAVE THIS (subtotal - subsidy)
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *`,
      [
        customerId,
        req.user.id, // dealer ID from auth
        JSON.stringify(products),
        discount,
        subtotal,              // Set price (complete package price)
        centralSubsidy || 0,
        stateSubsidy || 0,
        totalSubsidy || 0,
        amountAfterSubsidy || (subtotal - (totalSubsidy || 0)),
        discountAmount || 0,
        totalAmount || (amountAfterSubsidy - (discountAmount || 0)), // Amount after discount
        finalAmount || (subtotal - (totalSubsidy || 0)) // Subtotal - Subsidy
      ]
    );

    // Return response with saved values
    res.json({
      success: true,
      data: {
        id: quotation.rows[0].id,
        customer,
        products,
        discount,
        pricing: {
          subtotal: quotation.rows[0].subtotal,        // ← Return saved value (set price)
          centralSubsidy: quotation.rows[0].central_subsidy,
          stateSubsidy: quotation.rows[0].state_subsidy,
          totalSubsidy: quotation.rows[0].total_subsidy,
          amountAfterSubsidy: quotation.rows[0].amount_after_subsidy,
          discountAmount: quotation.rows[0].discount_amount,
          totalAmount: quotation.rows[0].total_amount,  // ← Return saved value (amount after discount)
          finalAmount: quotation.rows[0].final_amount   // ← Return saved value (subtotal - subsidy)
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

## Verification Steps

1. **Check Request Payload**: Verify that `subtotal`, `totalAmount`, and `finalAmount` are in the request body
2. **Check Database Insert**: Ensure the INSERT query includes `subtotal`, `total_amount`, and `final_amount` columns
3. **Check Database Values**: Query the database after creation to verify values were saved:
   ```sql
   SELECT id, subtotal, total_amount, final_amount, central_subsidy, state_subsidy, total_subsidy, created_at 
   FROM quotations 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
4. **Check Response**: Verify the response includes the saved `subtotal`, `totalAmount`, and `finalAmount` in the `pricing` object
5. **Verify Calculations**:
   - `subtotal` should be the set price (e.g., 300000)
   - `total_amount` should be `subtotal - total_subsidy - discount_amount` (e.g., 194750)
   - `final_amount` should be `subtotal - total_subsidy` (e.g., 205000)

---

## Frontend Logging

The frontend now logs the complete payload being sent. Check browser console for:
- "Sending quotation data with pricing:" - Shows all pricing values
- "Complete quotation payload:" - Shows the full JSON being sent

---

## Important Notes

1. **Subtotal = Set Price**: The `subtotal` field represents the set price (complete package price) for DCR/NON DCR/BOTH systems. This is the complete set price that includes all components.

2. **Total Amount = Amount After Discount**: The `totalAmount` field represents the amount after discount (Subtotal - Subsidy - Discount). This is what the customer pays after all deductions.

3. **Final Amount = Subtotal - Subsidy**: The `finalAmount` field represents the final amount after subsidy, but discount is NOT applied. Calculation: `subtotal - totalSubsidy`.

4. **Field Names**: The frontend sends `subtotal`, `totalAmount`, and `finalAmount` (camelCase). The database columns should be `subtotal`, `total_amount`, and `final_amount` (snake_case).

5. **Data Types**: All fields should be `DECIMAL(12,2)` to handle large amounts with precision.

6. **Validation**: The backend should validate that:
   - `subtotal > 0` (set price must be greater than 0)
   - `totalSubsidy >= 0`
   - `amountAfterSubsidy = subtotal - totalSubsidy`
   - `discountAmount = amountAfterSubsidy * (discount / 100)`
   - `totalAmount = amountAfterSubsidy - discountAmount` (amount after discount)
   - `finalAmount = subtotal - totalSubsidy` (discount NOT applied)

7. **Default Values**: If using `DEFAULT 0`, ensure the frontend always sends valid values (which it now does).

---

## Testing

After implementing the fix:

1. Create a new quotation from the frontend
2. Check the database to verify `subtotal`, `total_amount`, and `final_amount` are saved
3. Retrieve the quotation and verify the values are returned correctly
4. Check the browser console logs to see what was sent
5. Verify the calculations:
   - Subtotal = Set price (e.g., 300000)
   - Total Amount = Subtotal - Subsidy - Discount (e.g., 194750)
   - Final Amount = Subtotal - Subsidy (e.g., 205000)

---

## Priority

**CRITICAL** - Without these fields being saved, quotation pricing data is incomplete and cannot be properly tracked or displayed.

