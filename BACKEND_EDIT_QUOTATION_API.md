# Backend API Changes Required for Quotation Editing

## Overview
The frontend now supports editing of:
1. **Customer Information** - ✅ Already supported via `PUT /customers/{customerId}`
2. **System Configuration** - ❌ **NEW ENDPOINT NEEDED**
3. **Pricing Summary** - ⚠️ **PARTIALLY SUPPORTED** (only discount, needs extension)

## Required Backend Changes

### 1. Update Quotation Products/System Configuration

**Current Status**: Frontend can edit system configuration but changes are only saved locally, not persisted to backend.

**Required Endpoint**:
```
PATCH /quotations/{quotationId}/products
```

**Request Body**:
```json
{
  "products": {
    "systemType": "dcr" | "non-dcr" | "both" | "customize",
    
    // For DCR/NON-DCR/BOTH (non-customize)
    "panelBrand": "string",
    "panelSize": "string", // e.g., "550W"
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
        "type": "string"
      }
    ],
    
    // Common fields
    "inverterBrand": "string",
    "inverterType": "string",
    "inverterSize": "string",
    "structureType": "string",
    "structureSize": "string",
    "meterBrand": "string",
    "batteryCapacity": "string", // optional
    "acCableBrand": "string",
    "acCableSize": "string",
    "dcCableBrand": "string",
    "dcCableSize": "string",
    "acdb": "string",
    "dcdb": "string",
    "hybridInverter": "string", // optional
    "batteryPrice": number // optional
  }
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "QT-ABC123",
    "products": { /* updated products object */ },
    "updatedAt": "2025-12-17T15:00:00Z"
  }
}
```

**Notes**:
- Should validate that the quotation exists and belongs to the authenticated dealer (or admin)
- Should recalculate pricing if pricing is auto-calculated based on products
- Should update `updatedAt` timestamp

---

### 2. Update Quotation Pricing (Extended)

**Current Status**: Only discount can be updated via `PATCH /quotations/{quotationId}/discount`. Other pricing fields (subtotal, subsidies, finalAmount) need to be updatable.

**Option A: Extend Existing Discount Endpoint**
```
PATCH /quotations/{quotationId}/discount
```

**Request Body** (extended):
```json
{
  "discount": number, // 0-50
  "subtotal": number, // optional - manual override
  "stateSubsidy": number, // optional
  "centralSubsidy": number, // optional
  "finalAmount": number // optional - manual override
}
```

**Option B: New Endpoint** (Recommended)
```
PATCH /quotations/{quotationId}/pricing
```

**Request Body**:
```json
{
  "subtotal": number, // optional - manual override of calculated subtotal
  "stateSubsidy": number, // optional
  "centralSubsidy": number, // optional
  "discount": number, // 0-50
  "finalAmount": number // optional - manual override of calculated final amount
}
```

**Response (200 OK)**:
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
      "finalAmount": 216000
    },
    "discount": 10,
    "totalAmount": 300000,
    "finalAmount": 216000,
    "updatedAt": "2025-12-17T15:00:00Z"
  }
}
```

**Notes**:
- If `subtotal` is provided, it should override the calculated subtotal
- If `stateSubsidy` or `centralSubsidy` are provided, update the products object as well
- If `finalAmount` is provided, it should override the calculated final amount
- Should validate that subsidies don't exceed subtotal
- Should validate that discount is between 0-50
- Should validate that finalAmount is reasonable (not negative, not greater than subtotal)
- Should update `updatedAt` timestamp

---

### 3. Combined Update Endpoint (Alternative Approach)

**Option C: Single Endpoint for All Updates**
```
PATCH /quotations/{quotationId}
```

**Request Body**:
```json
{
  "products": { /* products object - optional */ },
  "pricing": {
    "subtotal": number, // optional
    "stateSubsidy": number, // optional
    "centralSubsidy": number, // optional
    "discount": number, // optional
    "finalAmount": number // optional
  }
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "QT-ABC123",
    "products": { /* updated products */ },
    "pricing": { /* updated pricing */ },
    "discount": 10,
    "totalAmount": 300000,
    "finalAmount": 216000,
    "updatedAt": "2025-12-17T15:00:00Z"
  }
}
```

**Notes**:
- Both `products` and `pricing` are optional - can update one or both
- Should validate all provided fields
- Should recalculate dependent fields if needed

---

## Frontend Implementation Notes

### Current Frontend Behavior:

1. **System Configuration Edit**:
   - Currently only updates local state: `setFullQuotation(updatedQuotation)`
   - No API call is made
   - **Needs**: `PATCH /quotations/{quotationId}/products` endpoint

2. **Pricing Summary Edit**:
   - Currently only updates discount via: `api.quotations.updateDiscount(quotationId, discount)`
   - Other fields (subtotal, subsidies, finalAmount) only update local state
   - **Needs**: Extended pricing update endpoint

### Frontend Code Locations:

- **System Configuration Save**: `components/quotation-details-dialog.tsx` line ~2158-2176
- **Pricing Summary Save**: `components/quotation-details-dialog.tsx` line ~2409-2443

---

## Recommended Implementation Priority

1. **High Priority**: `PATCH /quotations/{quotationId}/pricing` endpoint
   - Pricing changes are critical for business operations
   - Currently only discount is persisted

2. **Medium Priority**: `PATCH /quotations/{quotationId}/products` endpoint
   - System configuration changes should be persisted
   - Important for maintaining accurate quotation records

3. **Low Priority**: Combined update endpoint (if needed)
   - Can be implemented later if batch updates are required

---

## Database Considerations

When implementing these endpoints, consider:

1. **Audit Trail**: Should changes to quotations be logged?
2. **Validation**: 
   - Ensure products match system type
   - Validate pricing calculations
   - Check that subsidies are reasonable
3. **Recalculation**: 
   - If products change, should pricing be recalculated?
   - If pricing is manually overridden, should it be flagged?
4. **Permissions**: 
   - Who can edit quotations? (Dealer who created it? Admin? Both?)
   - Can quotations be edited after approval?

---

## Testing Checklist

- [ ] Update products for DCR system type
- [ ] Update products for NON-DCR system type
- [ ] Update products for BOTH system type
- [ ] Update products for CUSTOMIZE system type
- [ ] Update pricing (subtotal, subsidies, discount, finalAmount)
- [ ] Validate that only authorized users can update
- [ ] Validate pricing calculations
- [ ] Test error handling for invalid data
- [ ] Test concurrent updates
- [ ] Verify `updatedAt` timestamp is updated

---

## API Client Updates Needed

Once backend endpoints are ready, update `lib/api.ts`:

```typescript
quotations: {
  // ... existing methods ...
  
  updateProducts: async (quotationId: string, products: any) => {
    return apiRequest(`/quotations/${quotationId}/products`, {
      method: "PATCH",
      body: { products },
    })
  },
  
  updatePricing: async (quotationId: string, pricing: {
    subtotal?: number
    stateSubsidy?: number
    centralSubsidy?: number
    discount?: number
    finalAmount?: number
  }) => {
    return apiRequest(`/quotations/${quotationId}/pricing`, {
      method: "PATCH",
      body: pricing,
    })
  },
}
```

Then update frontend save handlers to call these new endpoints.
