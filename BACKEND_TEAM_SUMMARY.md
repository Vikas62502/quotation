# Backend Team - Summary of Required Changes

## Overview
The frontend has been updated to support editing quotations (System Configuration and Pricing Summary). **Two new API endpoints are required** to support these features.

---

## 🔴 CRITICAL: New Endpoints Required

### 1. Update Quotation Products/System Configuration
**Endpoint**: `PATCH /api/quotations/{quotationId}/products`

**Purpose**: Allow updating system configuration (panels, inverters, structure, etc.)

**Request**:
```json
POST /api/quotations/QT-123/products
{
  "products": {
    "systemType": "dcr",
    "panelBrand": "Adani",
    "panelSize": "550W",  // ⚠️ Note: Updated from 545W to 550W
    "panelQuantity": 6,
    "inverterBrand": "XWatt",
    "inverterType": "String Inverter",
    "inverterSize": "5kW",
    "structureType": "GI Structure",
    "structureSize": "5kW",
    "meterBrand": "L&T",
    "stateSubsidy": 30000,
    "centralSubsidy": 30000
    // ... other optional product fields
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "QT-123",
    "products": { /* updated products object */ },
    "updatedAt": "2025-12-17T15:00:00Z"
  }
}
```

---

### 2. Update Quotation Pricing
**Endpoint**: `PATCH /api/quotations/{quotationId}/pricing`

**Purpose**: Allow updating pricing fields (subtotal, subsidies, discount, finalAmount)

**Request**:
```json
POST /api/quotations/QT-123/pricing
{
  "subtotal": 300000,        // Optional - manual override
  "stateSubsidy": 30000,     // Optional
  "centralSubsidy": 30000,   // Optional
  "discount": 10,            // Optional (0-100)
  "finalAmount": 216000      // Optional - manual override
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "QT-123",
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
    "totalAmount": 300000,
    "finalAmount": 216000,
    "updatedAt": "2025-12-17T15:00:00Z"
  }
}
```

---

## 🟡 ENHANCEMENT: Existing Endpoint Update

### 3. Enhanced Discount Update
**Endpoint**: `PATCH /api/quotations/{quotationId}/discount` (EXISTING - needs update)

**Change Required**: Accept both `number` and `string` types for discount value

**Request** (should accept both):
```json
{
  "discount": 10    // Number (existing - should still work)
}
```

```json
{
  "discount": "10"  // String (NEW - should also work)
}
```

**Backward Compatibility**: ✅ Existing implementation should continue to work

---

## 📋 Data Update: Panel Size Change

### 4. Panel Size Updated: 545W → 550W

**Change**: All panel sizes have been updated from `545W` to `550W` in the frontend.

**Impact on Backend**:
- Update product catalog to include `550W` panels
- Update pricing tables to support `550W` panel size
- Update validation rules to accept `550W` as valid panel size
- **Backward Compatibility**: Existing quotations with `545W` should still work

**Product Catalog Update Required**:
```json
{
  "panels": [
    {
      "brand": "Adani",
      "size": "550W",  // Changed from 545W
      "price": 31000
    },
    {
      "brand": "Tata",
      "size": "550W",  // Changed from 545W
      "price": 32000
    },
    {
      "brand": "Waaree",
      "size": "550W",  // Changed from 545W
      "price": 30000
    }
    // ... other brands
  ]
}
```

---

## ⚠️ Important Notes

### Response Structure
The frontend `apiRequest` function automatically extracts `data.data` from the response, so:

**Backend should return:**
```json
{
  "success": true,
  "data": {
    "id": "QT-123",
    "products": { ... }
  }
}
```

**Frontend receives** (after unwrapping):
```javascript
{
  "id": "QT-123",
  "products": { ... }
}
```

**Don't return** `{ success: true, data: { data: { ... } } }` - frontend expects single-level `data`.

---

### Validation Rules

**Products Endpoint:**
- All product fields are optional (partial updates supported)
- Panel sizes should match catalog (including new `550W`)
- Custom panels required if `systemType` is 'customize'
- Validate product combinations

**Pricing Endpoint:**
- `discount` must be 0-100 (percentage)
- `subtotal` must be > 0
- Total subsidy (state + central) cannot exceed subtotal
- `finalAmount` must be between 0 and subtotal (after subsidies)
- At least one pricing field must be provided

---

### Permissions

- **Dealers**: Can only update their own quotations
- **Admins**: Can update any quotation
- **Authentication**: Required (Bearer token in Authorization header)

---

### Error Responses

All endpoints should return standard error format:

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
      }
    ]
  }
}
```

**Common Error Codes:**
- `AUTH_003`: User not authenticated (401)
- `AUTH_004`: Insufficient permissions (403)
- `RES_001`: Resource not found (404)
- `VAL_001`: Validation error (400)
- `VAL_002`: Required field missing (400)
- `VAL_003`: Invalid product selection (400)
- `SYS_001`: Internal server error (500)

---

## 🎯 Priority Implementation Order

1. **HIGH PRIORITY**: `PATCH /api/quotations/{quotationId}/pricing`
   - Critical for business operations
   - Currently only discount is persisted

2. **HIGH PRIORITY**: Panel size update (550W)
   - Required for current product offerings
   - Frontend already updated

3. **MEDIUM PRIORITY**: `PATCH /api/quotations/{quotationId}/products`
   - Important for maintaining accurate records
   - Currently only local state updates

4. **LOW PRIORITY**: Enhanced discount endpoint (accept string)
   - Nice-to-have enhancement
   - Existing number support works

---

## 📝 Testing Requirements

### Products Endpoint
- [ ] Update products for DCR system type
- [ ] Update products for NON-DCR system type
- [ ] Update products for BOTH system type
- [ ] Update products for CUSTOMIZE system type
- [ ] Validate panel size `550W` is accepted
- [ ] Test partial updates (only some fields)
- [ ] Test permission restrictions
- [ ] Test invalid product data returns proper errors

### Pricing Endpoint
- [ ] Update discount only
- [ ] Update subtotal only
- [ ] Update subsidies only
- [ ] Update finalAmount only
- [ ] Update multiple pricing fields at once
- [ ] Validate discount range (0-100)
- [ ] Validate subsidies don't exceed subtotal
- [ ] Test permission restrictions
- [ ] Test invalid pricing data returns proper errors

### Discount Endpoint Enhancement
- [ ] Accept number type (existing)
- [ ] Accept string type (new: "10", "10.5", "0.00")
- [ ] Parse string to number correctly
- [ ] Validate converted value (0-100)

### Panel Size Update
- [ ] Product catalog includes `550W` panels
- [ ] Pricing tables support `550W`
- [ ] Validation accepts `550W` as valid
- [ ] Existing quotations with `545W` still work (backward compatibility)

---

## 🔍 Frontend Integration Details

### Frontend Code Locations
- **API Client**: `lib/api.ts` - Already has methods `updateProducts()` and `updatePricing()`
- **System Config Save**: `components/quotation-details-dialog.tsx` line ~2165
- **Pricing Save**: `components/quotation-details-dialog.tsx` line ~2445

### Frontend API Calls

**Products Update:**
```typescript
await api.quotations.updateProducts(quotationId, {
  systemType: "dcr",
  panelBrand: "Adani",
  panelSize: "550W",
  panelQuantity: 6,
  // ... other fields
})
```

**Pricing Update:**
```typescript
await api.quotations.updatePricing(quotationId, {
  subtotal: 300000,
  stateSubsidy: 30000,
  centralSubsidy: 30000,
  discount: 10,
  finalAmount: 216000
})
```

---

## 📚 Additional Documentation

- **Detailed API Spec**: See `BACKEND_EDIT_QUOTATION_API.md`
- **Frontend Integration**: See `FRONTEND_API_INTEGRATION_COMPLETE.md`
- **API Endpoints Summary**: See `API_ENDPOINTS_SUMMARY.md`
- **API Specification**: See `API_SPECIFICATION.txt`

---

## ❓ Questions for Backend Team

1. **Pricing Recalculation**: Should the backend automatically recalculate pricing when products are updated?

2. **Audit Trail**: Do you want to implement audit logging for quotation changes?

3. **Permissions**: Should dealers be able to edit quotations after approval?

4. **Subsidy Updates**: When subsidies are updated via pricing endpoint, should they be reflected in the products object as well?

5. **Final Amount Override**: Should manual finalAmount overrides be flagged differently than calculated amounts?

---

## ✅ Current Status

### Frontend (✅ COMPLETE)
- ✅ System Configuration edit UI implemented
- ✅ Pricing Summary edit UI implemented
- ✅ API client methods added
- ✅ Error handling implemented
- ✅ Toast notifications implemented
- ✅ Panel size updated to 550W

### Backend (❌ REQUIRED)
- ❌ `PATCH /api/quotations/{quotationId}/products` - **NEEDED**
- ❌ `PATCH /api/quotations/{quotationId}/pricing` - **NEEDED**
- ⚠️ `PATCH /api/quotations/{quotationId}/discount` - Enhancement (accept string)
- ⚠️ Panel size `550W` support - **NEEDED**
- ⚠️ Status filtering for approved quotations (may already exist)

---

## 🚀 Next Steps

1. **Backend Team**: Implement the two new endpoints (`/products` and `/pricing`)
2. **Backend Team**: Update product catalog to support `550W` panels
3. **Backend Team**: Update validation rules to accept `550W`
4. **Testing**: Test both endpoints with frontend integration
5. **Deployment**: Deploy backend changes first, then frontend will work automatically

---

## 📞 Contact

For questions or clarifications:
- Frontend API Client: `lib/api.ts`
- Frontend Implementation: `components/quotation-details-dialog.tsx`
- API Documentation: `API_SPECIFICATION.txt`
