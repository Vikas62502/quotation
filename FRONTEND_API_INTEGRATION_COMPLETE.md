# Frontend API Integration - Quotation Editing

## Summary
Successfully integrated the new backend endpoints for editing quotations. The frontend now persists changes to system configuration and pricing via API calls.

## Changes Made

### 1. API Client Updates (`lib/api.ts`)

**Added new methods**:
- `updateProducts(quotationId, products)` - Updates quotation system configuration
- `updatePricing(quotationId, pricing)` - Updates quotation pricing fields

**Updated existing method**:
- `updateDiscount(quotationId, discount)` - Now accepts both `number` and `string` types

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

---

### 2. Quotation Details Dialog Updates (`components/quotation-details-dialog.tsx`)

#### Added Toast Notifications
- Imported `useToast` hook
- Replaced `alert()` calls with toast notifications for better UX
- Success toasts for successful updates
- Error toasts with destructive variant for failures

#### System Configuration Save Handler
**Location**: Line ~2157-2182

**Before**: Only updated local state
**After**: 
- Calls `api.quotations.updateProducts()` when using API
- Updates local state with server response
- Shows success/error toast notifications
- Falls back to local state update when not using API

**Key Changes**:
```typescript
if (useApi) {
  const response = await api.quotations.updateProducts(displayQuotation.id, systemConfigEditForm)
  if (response && response.success) {
    setFullQuotation({
      ...displayQuotation,
      products: response.data.products || systemConfigEditForm,
    })
    toast({ title: "Success", description: "System configuration updated successfully!" })
  }
} else {
  // Fallback for non-API mode
}
```

#### Pricing Summary Save Handler
**Location**: Line ~2408-2449

**Before**: Only updated discount via API, other fields only updated locally
**After**:
- Calls `api.quotations.updatePricing()` with all pricing fields
- Updates local state with complete server response including pricing breakdown
- Shows success/error toast notifications
- Falls back to local state update when not using API

**Key Changes**:
```typescript
if (useApi) {
  const response = await api.quotations.updatePricing(displayQuotation.id, {
    subtotal: pricingEditForm.subtotal,
    stateSubsidy: pricingEditForm.stateSubsidy,
    centralSubsidy: pricingEditForm.centralSubsidy,
    discount: pricingEditForm.discount,
    finalAmount: pricingEditForm.finalAmount,
  })
  
  if (response && response.success) {
    // Update with complete server response
    const updatedQuotation = {
      ...displayQuotation,
      products: updatedProducts,
      discount: response.data.discount,
      totalAmount: response.data.totalAmount,
      finalAmount: response.data.finalAmount,
      pricing: response.data.pricing,
    }
    setFullQuotation(updatedQuotation)
    toast({ title: "Success", description: "Pricing information updated successfully!" })
  }
}
```

---

### 3. Layout Updates (`app/layout.tsx`)

**Added Toaster Component**:
- Imported `Toaster` from `@/components/ui/toaster`
- Added `<Toaster />` to the layout so toast notifications are displayed globally

```typescript
import { Toaster } from "@/components/ui/toaster"

// In JSX:
<Toaster />
<Analytics />
```

---

## API Endpoints Used

### 1. PATCH `/api/quotations/{quotationId}/products`
- **Purpose**: Update system configuration and product details
- **Request**: `{ products: {...} }`
- **Response**: `{ success: true, data: { id, products, updatedAt } }`

### 2. PATCH `/api/quotations/{quotationId}/pricing`
- **Purpose**: Update pricing fields (subtotal, subsidies, discount, finalAmount)
- **Request**: `{ subtotal?, stateSubsidy?, centralSubsidy?, discount?, finalAmount? }`
- **Response**: `{ success: true, data: { id, pricing, discount, totalAmount, finalAmount, updatedAt } }`

---

## Error Handling

All API calls include proper error handling:
- Try-catch blocks around API calls
- Error messages displayed via toast notifications
- Console logging for debugging
- Graceful fallback to local state when not using API

**Error Toast Example**:
```typescript
toast({
  title: "Error",
  description: errorMessage,
  variant: "destructive",
})
```

---

## Testing Checklist

- [x] API client methods added
- [x] System configuration save handler updated
- [x] Pricing summary save handler updated
- [x] Toast notifications integrated
- [x] Toaster component added to layout
- [ ] Test system configuration update for DCR system
- [ ] Test system configuration update for NON-DCR system
- [ ] Test system configuration update for BOTH system
- [ ] Test system configuration update for CUSTOMIZE system
- [ ] Test pricing update with all fields
- [ ] Test error handling for invalid data
- [ ] Test error handling for unauthorized access
- [ ] Verify changes persist after page refresh

---

## Backward Compatibility

- ✅ Existing `updateDiscount` calls continue to work
- ✅ Non-API mode (localStorage) still works as fallback
- ✅ All changes are backward compatible

---

## Next Steps

1. **Testing**: Test all edit scenarios with the backend API
2. **Error Handling**: Verify error messages are user-friendly
3. **Loading States**: Consider adding loading indicators during save operations
4. **Optimistic Updates**: Consider implementing optimistic UI updates for better UX
5. **Validation**: Add client-side validation before API calls

---

## Notes

- Toast notifications provide better UX than `alert()` dialogs
- Server responses are used to update local state to ensure consistency
- All pricing fields are now persisted, not just discount
- System configuration changes are now persisted to backend
- Error handling includes both API errors and network errors

---

## Files Modified

1. `lib/api.ts` - Added new API methods
2. `components/quotation-details-dialog.tsx` - Updated save handlers and added toast
3. `app/layout.tsx` - Added Toaster component

---

## Questions or Issues?

If you encounter any issues:
1. Check browser console for error messages
2. Verify API endpoints are accessible
3. Check network tab for API request/response details
4. Verify authentication token is valid
