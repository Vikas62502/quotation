# Backend Changes Required - Frontend Implementation Summary

## Overview
The frontend has been updated to support editing quotations (System Configuration and Pricing Summary). The following backend API endpoints are required to support these new features.

---

## 1. Update Quotation Products/System Configuration

### Endpoint Required
```
PATCH /api/quotations/{quotationId}/products
```

### Purpose
Allow updating the system configuration and product details for an existing quotation.

### Request Body
```json
{
  "products": {
    "systemType": "dcr" | "non-dcr" | "both" | "customize" | "on-grid" | "off-grid" | "hybrid",
    
    // For DCR/NON-DCR/BOTH (non-customize)
    "panelBrand": "string",
    "panelSize": "string",  // e.g., "550W" (updated from 545W)
    "panelQuantity": number,
    
    // For BOTH system type
    "dcrPanelBrand": "string",
    "dcrPanelSize": "string",
    "dcrPanelQuantity": number,
    "nonDcrPanelBrand": "string",
    "nonDcrPanelSize": "string",
    "nonDcrPanelQuantity": number,
    
    // For CUSTOMIZE system type
    "customPanels": [
      {
        "brand": "string",
        "size": "string",
        "quantity": number,
        "type": "dcr" | "non-dcr",
        "price": number
      }
    ],
    
    // Common fields (all optional - only provided fields are updated)
    "inverterBrand": "string",
    "inverterType": "string",
    "inverterSize": "string",
    "structureType": "string",
    "structureSize": "string",
    "meterBrand": "string",
    "batteryCapacity": "string",
    "acCableBrand": "string",
    "acCableSize": "string",
    "dcCableBrand": "string",
    "dcCableSize": "string",
    "acdb": "string",
    "dcdb": "string",
    "hybridInverter": "string",
    "batteryPrice": number,
    
    // Subsidy fields
    "stateSubsidy": number,
    "centralSubsidy": number
  }
}
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "QT-ABC123",
    "products": {
      // Updated products object with all fields
      "systemType": "dcr",
      "panelBrand": "Adani",
      "panelSize": "550W",
      "panelQuantity": 6,
      // ... other product fields
    },
    "updatedAt": "2025-12-17T15:00:00Z"
  }
}
```

### Validation Rules
- Products should be validated against the product catalog
- Custom panels array is required if `systemType` is 'customize'
- All product fields are optional (partial update supported)
- Panel sizes should match available sizes (e.g., "550W" - note: updated from 545W)
- Should recalculate pricing if pricing is auto-calculated based on products

### Permissions
- Dealers can only update their own quotations
- Admins can update any quotation

### Error Responses
```json
{
  "success": false,
  "error": {
    "code": "VAL_001",
    "message": "Validation error",
    "details": [
      {
        "field": "products.panelSize",
        "message": "Invalid panel size. Must be one of: 440W, 550W, etc."
      }
    ]
  }
}
```

---

## 2. Update Quotation Pricing

### Endpoint Required
```
PATCH /api/quotations/{quotationId}/pricing
```

### Purpose
Allow updating pricing fields including subtotal, subsidies, discount, and final amount.

### Request Body
```json
{
  "subtotal": number,        // Optional - manual override of calculated subtotal
  "stateSubsidy": number,    // Optional - state subsidy amount
  "centralSubsidy": number,  // Optional - central subsidy amount
  "discount": number,        // Optional - discount percentage (0-100)
  "finalAmount": number      // Optional - manual override of calculated final amount
}
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "QT-ABC123",
    "pricing": {
      "subtotal": 300000,
      "totalSubsidy": 60000,
      "stateSubsidy": 30000,
      "centralSubsidy": 30000,
      "amountAfterSubsidy": 240000,
      "discount": 10,
      "discountAmount": 24000,
      "totalAmount": 300000,
      "finalAmount": 216000
    },
    "discount": 10,
    "subtotal": 300000,
    "totalAmount": 300000,
    "finalAmount": 216000,
    "updatedAt": "2025-12-17T15:00:00Z"
  }
}
```

### Validation Rules
- `discount` must be between 0-100 (percentage)
- `subtotal` must be greater than 0
- Total subsidy (state + central) cannot exceed subtotal
- `finalAmount` must be between 0 and subtotal (after subsidies)
- At least one pricing field must be provided
- If `stateSubsidy` or `centralSubsidy` are provided, update the products object as well

### Business Logic
1. **If subtotal is provided**: Override the calculated subtotal
2. **If subsidies are provided**: 
   - Update products.stateSubsidy and products.centralSubsidy
   - Recalculate amountAfterSubsidy = subtotal - (stateSubsidy + centralSubsidy)
3. **If discount is provided**:
   - Recalculate discountAmount = amountAfterSubsidy * (discount / 100)
   - Recalculate finalAmount = amountAfterSubsidy - discountAmount
4. **If finalAmount is provided**: Override the calculated final amount (manual override)

### Permissions
- Dealers can update pricing for their own quotations
- Admins can update pricing for any quotation

### Error Responses
```json
{
  "success": false,
  "error": {
    "code": "VAL_001",
    "message": "Validation error",
    "details": [
      {
        "field": "discount",
        "message": "Discount must be between 0 and 100"
      },
      {
        "field": "subsidy",
        "message": "Total subsidy cannot exceed subtotal"
      }
    ]
  }
}
```

---

## 3. Enhanced Discount Update (Existing Endpoint)

### Endpoint
```
PATCH /api/quotations/{quotationId}/discount
```

### Change Required
**Currently**: Accepts only `number` type for discount
**Required**: Accept both `number` and `string` (e.g., "0.00", "10.5")

### Request Body (Updated)
```json
{
  "discount": 10    // Accepts: number OR string ("10", "10.5", "0.00")
}
```

### Backward Compatibility
- Existing implementation should continue to work
- Accept both number and string types
- Parse string to number if needed

---

## 4. Account Management - Approved Quotations Filter

### Endpoint (May Already Exist)
```
GET /api/admin/quotations?status=approved
GET /api/quotations?status=approved
```

### Requirement
- Support filtering by status in query parameters
- Return only approved quotations when `status=approved` is provided
- For dealers, return only their approved quotations
- For admins, return all approved quotations

### Response Structure
```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "id": "QT-ABC123",
        "status": "approved",
        "customer": { ... },
        "products": { ... },
        "pricing": { ... },
        // ... other fields
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Note
This may already be implemented. If not, add status filtering to existing endpoints.

---

## 5. Panel Size Update (Data Change)

### Change Required
**Panel Size Updated**: From `545W` to `550W`

### Impact
- Update product catalog to include `550W` panels
- Pricing tables should support `550W` panel size
- Update validation rules to accept `550W` as valid panel size
- Frontend has already been updated to use `550W`

### Product Catalog Update
```json
{
  "panels": [
    {
      "brand": "Adani",
      "size": "550W",  // Updated from 545W
      "price": 31000
    },
    {
      "brand": "Tata",
      "size": "550W",  // Updated from 545W
      "price": 32000
    },
    {
      "brand": "Waaree",
      "size": "550W",  // Updated from 545W
      "price": 30000
    }
    // ... other brands
  ]
}
```

---

## API Response Structure Requirements

### Standard Response Format
All endpoints should follow this structure:

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data object
  },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "fieldName",
        "message": "Field-specific error message"
      }
    ]
  }
}
```

### Important Note on Response Data
The frontend `apiRequest` function extracts `data.data` from the response, so:
- Backend should return: `{ success: true, data: { ...actualData... } }`
- Frontend receives: `{ ...actualData... }` (after unwrapping)

**Example:**
```typescript
// Backend Response
{
  "success": true,
  "data": {
    "id": "QT-123",
    "products": { ... }
  }
}

// Frontend receives (after apiRequest unwrapping)
{
  "id": "QT-123",
  "products": { ... }
}
```

---

## Error Codes

### Common Error Codes to Use

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTH_001` | Invalid credentials | 401 |
| `AUTH_002` | Token expired | 401 |
| `AUTH_003` | Invalid token | 401 |
| `AUTH_004` | Insufficient permissions | 403 |
| `VAL_001` | Validation error | 400 |
| `VAL_002` | Required field missing | 400 |
| `VAL_003` | Invalid product selection | 400 |
| `RES_001` | Resource not found | 404 |
| `SYS_001` | Internal server error | 500 |

### Specific Validation Errors

**For Products Endpoint:**
- `VAL_003`: Invalid product selection (e.g., panel size not in catalog)
- `VAL_001`: Invalid system type
- `VAL_002`: Custom panels required for 'customize' system type

**For Pricing Endpoint:**
- `VAL_001`: Discount must be 0-100
- `VAL_001`: Subtotal must be greater than 0
- `VAL_001`: Total subsidy cannot exceed subtotal
- `VAL_001`: Final amount must be between 0 and subtotal

---

## Database Considerations

### Fields to Update

**Quotations Table:**
- `products` (JSON/JSONB) - Update with new product values
- `discount` (DECIMAL/NUMBER) - Update discount percentage
- `totalAmount` (DECIMAL/NUMBER) - Update if subtotal changed
- `finalAmount` (DECIMAL/NUMBER) - Update final amount
- `updatedAt` (TIMESTAMP) - Auto-update on modification
- `status` (ENUM/STRING) - Already exists, no change needed

**Products JSON Structure:**
```json
{
  "systemType": "dcr",
  "panelBrand": "Adani",
  "panelSize": "550W",  // Updated from 545W
  "panelQuantity": 6,
  "inverterBrand": "XWatt",
  "inverterType": "String Inverter",
  "inverterSize": "5kW",
  "structureType": "GI Structure",
  "structureSize": "5kW",
  "meterBrand": "L&T",
  "acCableBrand": "Polycab",
  "acCableSize": "4 sq mm",
  "dcCableBrand": "Polycab",
  "dcCableSize": "4 sq mm",
  "acdb": "Havells (1-Phase)",
  "dcdb": "Havells (1-Phase)",
  "stateSubsidy": 30000,
  "centralSubsidy": 30000,
  "batteryCapacity": null,
  "batteryPrice": null
}
```

**Pricing JSON Structure (if stored separately):**
```json
{
  "subtotal": 300000,
  "totalSubsidy": 60000,
  "stateSubsidy": 30000,
  "centralSubsidy": 30000,
  "amountAfterSubsidy": 240000,
  "discount": 10,
  "discountAmount": 24000,
  "totalAmount": 300000,
  "finalAmount": 216000
}
```

### Audit Trail (Optional but Recommended)
Consider adding an audit log for quotation updates:
- Track who made the change (admin/dealer ID)
- Track what was changed (field-level changes)
- Track when the change was made (timestamp)
- Track previous values

---

## Testing Checklist for Backend Team

### Products Endpoint (`PATCH /api/quotations/{quotationId}/products`)
- [ ] Update products for DCR system type
- [ ] Update products for NON-DCR system type
- [ ] Update products for BOTH system type
- [ ] Update products for CUSTOMIZE system type
- [ ] Validate panel sizes (including new 550W)
- [ ] Validate product combinations
- [ ] Test partial updates (only update some fields)
- [ ] Test with invalid product data
- [ ] Test permission restrictions (dealer can only update own)
- [ ] Test admin can update any quotation
- [ ] Verify pricing recalculation (if auto-calculated)
- [ ] Verify `updatedAt` timestamp is updated

### Pricing Endpoint (`PATCH /api/quotations/{quotationId}/pricing`)
- [ ] Update discount only
- [ ] Update subtotal only
- [ ] Update subsidies only
- [ ] Update finalAmount only
- [ ] Update multiple pricing fields at once
- [ ] Validate discount range (0-100)
- [ ] Validate subtotal > 0
- [ ] Validate subsidies don't exceed subtotal
- [ ] Validate finalAmount range
- [ ] Test pricing calculations (auto-calculate dependent fields)
- [ ] Test with invalid pricing data
- [ ] Test permission restrictions
- [ ] Verify `updatedAt` timestamp is updated

### Discount Endpoint Enhancement (`PATCH /api/quotations/{quotationId}/discount`)
- [ ] Accept number type (existing - should still work)
- [ ] Accept string type (new requirement: "10", "10.5", "0.00")
- [ ] Parse string to number correctly
- [ ] Validate converted discount value (0-100)

### Approved Quotations Filter
- [ ] Filter by status=approved works
- [ ] Returns only approved quotations
- [ ] Pagination works with status filter
- [ ] Dealers see only their approved quotations
- [ ] Admins see all approved quotations

### Panel Size Update (550W)
- [ ] Product catalog includes 550W panels
- [ ] Pricing tables support 550W
- [ ] Validation accepts 550W as valid
- [ ] Existing quotations with 545W still work (backward compatibility)

---

## Frontend Integration Points

### Products Update
**Frontend Code Location**: `components/quotation-details-dialog.tsx` line ~2165

**Frontend Call:**
```typescript
await api.quotations.updateProducts(quotationId, {
  systemType: "dcr",
  panelBrand: "Adani",
  panelSize: "550W",
  panelQuantity: 6,
  // ... other product fields
})
```

**Expected Backend Response:**
```typescript
{
  id: "QT-123",
  products: { /* updated products */ },
  updatedAt: "2025-12-17T15:00:00Z"
}
```

### Pricing Update
**Frontend Code Location**: `components/quotation-details-dialog.tsx` line ~2445

**Frontend Call:**
```typescript
await api.quotations.updatePricing(quotationId, {
  subtotal: 300000,
  stateSubsidy: 30000,
  centralSubsidy: 30000,
  discount: 10,
  finalAmount: 216000
})
```

**Expected Backend Response:**
```typescript
{
  id: "QT-123",
  pricing: {
    subtotal: 300000,
    stateSubsidy: 30000,
    centralSubsidy: 30000,
    totalSubsidy: 60000,
    amountAfterSubsidy: 240000,
    discount: 10,
    discountAmount: 24000,
    totalAmount: 300000,
    finalAmount: 216000
  },
  discount: 10,
  totalAmount: 300000,
  finalAmount: 216000,
  updatedAt: "2025-12-17T15:00:00Z"
}
```

---

## Priority Implementation Order

1. **High Priority**: `PATCH /api/quotations/{quotationId}/pricing`
   - Critical for business operations
   - Currently only discount is persisted

2. **High Priority**: Panel size update (550W)
   - Required for current product offerings
   - Frontend already updated

3. **Medium Priority**: `PATCH /api/quotations/{quotationId}/products`
   - Important for maintaining accurate records
   - Currently only local state updates

4. **Low Priority**: Enhanced discount endpoint (accept string)
   - Nice-to-have enhancement
   - Existing number support works

5. **Low Priority**: Status filtering for approved quotations
   - May already be implemented
   - Check existing endpoints first

---

## Questions for Backend Team

1. **Pricing Recalculation**: Should the backend automatically recalculate pricing when products are updated, or should pricing updates be separate?

2. **Audit Trail**: Do you want to implement audit logging for quotation changes? If yes, what fields should be tracked?

3. **Permissions**: Should dealers be able to edit quotations after approval, or should editing be locked once approved?

4. **Subsidy Updates**: When subsidies are updated via pricing endpoint, should they be reflected in the products object as well?

5. **Final Amount Override**: Should manual finalAmount overrides be flagged or tracked differently than calculated amounts?

---

## Additional Notes

1. **Backward Compatibility**: Ensure existing quotations with 545W panels continue to work. Don't break existing data.

2. **Pricing Calculation**: If pricing is auto-calculated based on products, ensure recalculation happens when products are updated.

3. **Partial Updates**: Both endpoints support partial updates - only provided fields should be updated.

4. **Validation**: Strict validation is important - invalid data should return clear error messages.

5. **Performance**: Consider adding database indexes on frequently queried fields (status, dealerId, updatedAt).

---

## Contact

For questions or clarifications about these requirements, please refer to:
- Frontend API client: `lib/api.ts`
- Frontend save handlers: `components/quotation-details-dialog.tsx`
- API specification: `API_SPECIFICATION.txt`
- Endpoints summary: `API_ENDPOINTS_SUMMARY.md`
