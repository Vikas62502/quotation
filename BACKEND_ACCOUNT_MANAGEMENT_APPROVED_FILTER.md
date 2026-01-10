# Backend Team - Account Management Approved Quotations Filter

## Overview
Account Management users should **ONLY** see quotations that have been **approved by admin**. The backend must filter quotations by `status === "approved"` when account management users request quotations.

---

## 🔴 CRITICAL: Backend Filtering Required

### Current Behavior
- Frontend calls `GET /api/admin/quotations` 
- Frontend filters client-side for `status === "approved"`

### Required Behavior
- Frontend calls `GET /api/admin/quotations?status=approved`
- **Backend must return ONLY approved quotations**
- Account Management users should never see pending, rejected, or any other status

---

## 📋 API Endpoint Update Required

### Endpoint: `GET /api/admin/quotations`

**Current**: Optional status filtering
**Required**: **MANDATORY status filtering** for account management users

### Query Parameter: `status=approved`

**Request Example**:
```
GET /api/admin/quotations?status=approved&page=1&limit=1000
```

**Backend Implementation**:
```typescript
// Backend should filter by status BEFORE returning data
GET /api/admin/quotations?status=approved

// SQL Query (example)
SELECT * FROM quotations WHERE status = 'approved' ORDER BY createdAt DESC
```

**Response**:
```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "id": "QT-123",
        "status": "approved",  // ⚠️ MUST be "approved"
        "customer": { ... },
        "products": { ... },
        "pricing": { ... },
        "createdAt": "2025-12-17T10:00:00Z",
        // ... other fields
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 1000,
      "total": 50,
      "totalPages": 1
    }
  }
}
```

---

## 🔒 Security Requirements

### 1. Server-Side Filtering (MANDATORY)
- ✅ **Backend MUST filter by status on server side**
- ❌ **Never rely on frontend filtering alone**
- ✅ **Double-check that status === "approved" before returning**

### 2. Account Management User Access
- Account Management users use `GET /api/admin/quotations?status=approved`
- **Backend should enforce**: Only return quotations with `status === "approved"`
- **Even if frontend doesn't pass status parameter**, backend should default to approved for account management users

### 3. Role-Based Filtering (Optional Enhancement)
If the backend can identify the user role from the token:
- **For account-management role**: Automatically filter to `status === "approved"` only
- **For admin role**: Return all statuses (or based on query parameter)

**Token Structure** (if available):
```json
{
  "id": "account-mgr-001",
  "role": "account-management"
}
```

**Backend Logic**:
```typescript
// Pseudo-code
const userRole = req.user.role  // From JWT token

if (userRole === "account-management") {
  // Force status filter to "approved"
  if (queryParams.status && queryParams.status !== "approved") {
    return res.status(403).json({
      success: false,
      error: {
        code: "AUTH_004",
        message: "Account management users can only view approved quotations"
      }
    })
  }
  // Always filter for approved
  queryParams.status = "approved"
}
```

---

## 📋 Frontend Implementation

### Current Frontend Code
```typescript
// Frontend requests approved quotations with status parameter
const response = await api.admin.quotations.getAll({
  status: "approved",  // ✅ Request only approved
  page: 1,
  limit: 1000,
})

// Double-check on frontend (safety measure)
const approvedQuotations = quotationsList
  .filter((q: any) => q.status === "approved")  // ✅ Additional safety check
```

### Expected Backend Behavior
1. **When `status=approved` is provided**: Return ONLY approved quotations
2. **When `status` is not provided**: 
   - If user is account-management role → Return only approved
   - If user is admin role → Return all statuses (current behavior)
3. **When `status=pending` or other**: 
   - If user is account-management role → Return 403 error (not allowed)
   - If user is admin role → Return filtered results

---

## ✅ Validation Rules

### Backend Should Validate
- ✅ `status` parameter must be "approved" for account-management users
- ✅ Return 403 if account-management user requests non-approved status
- ✅ Always filter results by `status === "approved"` on server side
- ✅ Never return pending, rejected, or other statuses to account management users

### Response Validation
- ✅ All returned quotations must have `status: "approved"`
- ✅ No pending quotations in response
- ✅ No rejected quotations in response
- ✅ Only approved quotations visible to account management

---

## 🔄 Workflow

### Admin Approves Quotation
1. Admin logs in to Admin Panel
2. Admin views quotation in `/dashboard/admin`
3. Admin changes status to "Approved"
4. Backend updates quotation: `status = "approved"`
5. Quotation is saved with approved status

### Account Management User Views Quotations
1. Account Management user logs in at `/account-management-login`
2. Account Management user navigates to `/dashboard/account-management`
3. Frontend calls: `GET /api/admin/quotations?status=approved`
4. **Backend filters**: Only quotations where `status === "approved"`
5. **Backend returns**: Only approved quotations
6. Frontend displays: Only approved quotations (with additional client-side filter as safety)

---

## 🎯 Implementation Priority

### High Priority ⚠️
- ✅ Support `?status=approved` query parameter in `GET /api/admin/quotations`
- ✅ Filter quotations by status on server side (database query)
- ✅ Return only approved quotations when `status=approved` is provided

### Medium Priority
- ✅ Role-based automatic filtering (if user role is account-management, always filter to approved)
- ✅ Validation to prevent account-management users from requesting other statuses

### Low Priority
- ⚠️ Caching approved quotations (performance optimization)
- ⚠️ Real-time updates when admin approves (WebSocket)

---

## 📊 Database Query Example

### SQL Query (PostgreSQL/MySQL)
```sql
-- Get only approved quotations
SELECT 
  q.*,
  c.*,
  p.*,
  pr.*
FROM quotations q
LEFT JOIN customers c ON q.customer_id = c.id
LEFT JOIN products p ON q.id = p.quotation_id
LEFT JOIN pricing pr ON q.id = pr.quotation_id
WHERE q.status = 'approved'
ORDER BY q.created_at DESC
LIMIT 1000 OFFSET 0;
```

### Sequelize Example (if using Sequelize ORM)
```typescript
const quotations = await Quotation.findAll({
  where: {
    status: 'approved'  // Filter by approved status
  },
  include: [
    { model: Customer, as: 'customer' },
    { model: Product, as: 'products' },
    { model: Pricing, as: 'pricing' }
  ],
  order: [['createdAt', 'DESC']],
  limit: 1000,
  offset: 0
})
```

---

## ✅ Testing Checklist

### Backend Testing
- [ ] Test `GET /api/admin/quotations?status=approved` returns only approved quotations
- [ ] Test that no pending quotations are returned
- [ ] Test that no rejected quotations are returned
- [ ] Test that account-management users cannot access non-approved statuses
- [ ] Test pagination works with status filter
- [ ] Test search works with status filter
- [ ] Test sorting works with status filter

### Integration Testing
- [ ] Admin approves a quotation → Appears in Account Management
- [ ] Admin rejects a quotation → Does NOT appear in Account Management
- [ ] Quotation is pending → Does NOT appear in Account Management
- [ ] Account Management user logs in → Sees only approved quotations
- [ ] Account Management user searches → Only searches approved quotations
- [ ] Account Management user views details → Can view approved quotation details

---

## 🔐 Security Considerations

### Never Trust Client
- ❌ **Never rely on frontend to filter status**
- ✅ **Always filter on backend/server side**
- ✅ **Validate user role if possible**
- ✅ **Double-check status in database query**

### Access Control
- Account Management users should have **read-only** access to approved quotations
- Account Management users should **NOT** be able to:
  - View pending quotations (403 error)
  - View rejected quotations (403 error)
  - Change quotation status (403 error)
  - Edit quotations (403 error - unless explicitly allowed)

---

## 📝 Response Format

### Success Response (Only Approved Quotations)
```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "id": "QT-123",
        "status": "approved",  // ⚠️ All must be "approved"
        "customer": {
          "firstName": "John",
          "lastName": "Doe",
          "mobile": "9876543210",
          "email": "john@example.com"
        },
        "products": { ... },
        "pricing": {
          "totalAmount": 300000,
          "finalAmount": 240000
        },
        "createdAt": "2025-12-17T10:00:00Z",
        "dealerId": "dealer-001"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 1000,
      "total": 50,
      "totalPages": 1
    }
  }
}
```

### Error Response (If Account Management User Requests Non-Approved Status)
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Account management users can only view approved quotations"
  }
}
```

---

## 🔄 Frontend Behavior

### Current Implementation
```typescript
// Frontend explicitly requests approved status
const response = await api.admin.quotations.getAll({
  status: "approved",  // ✅ Explicitly request only approved
  page: 1,
  limit: 1000,
})

// Additional safety filter on frontend
const approvedQuotations = quotationsList
  .filter((q: any) => q.status === "approved")  // ✅ Double-check
```

### What Frontend Expects
- ✅ Backend returns only quotations with `status === "approved"`
- ✅ All quotations in response have `status: "approved"`
- ✅ No pending, rejected, or other statuses in response
- ✅ If backend returns non-approved, frontend filters them out (safety measure)

---

## ✅ Summary

### What Backend Needs to Do:
1. ✅ **Support `?status=approved` query parameter** in `/api/admin/quotations`
2. ✅ **Filter quotations by status on server side** (database query)
3. ✅ **Return only approved quotations** when status parameter is provided
4. ✅ **Validate that account-management users only see approved** (role-based filtering if possible)
5. ✅ **Return 403 error** if account-management user requests non-approved status

### What Frontend Already Does:
- ✅ Requests quotations with `status: "approved"` parameter
- ✅ Double-checks status on frontend (safety measure)
- ✅ Only displays approved quotations
- ✅ Shows appropriate empty state messages

### Integration Status:
- **Frontend**: ✅ Ready - Requests approved status explicitly
- **Backend**: ⚠️ Needs to implement status filtering
- **Can Test**: ⚠️ Partially - Frontend will filter client-side if backend doesn't support it yet

---

## 📞 Contact

For questions about approved quotations filtering:
- **Frontend Implementation**: `app/dashboard/account-management/page.tsx` - `loadApprovedQuotations()` function
- **API Client**: `lib/api.ts` - `api.admin.quotations.getAll()` method
- **Backend Endpoint**: `GET /api/admin/quotations`

---

## Notes

- **Security**: Always filter on backend - never trust client-side filtering
- **Performance**: Server-side filtering is more efficient (less data transfer)
- **Data Integrity**: Backend is source of truth - ensure status filtering happens in database query
- **User Experience**: Account Management users should only see what they need (approved quotations)
- **Future Enhancement**: Consider adding automatic status filter based on user role (no query parameter needed)
