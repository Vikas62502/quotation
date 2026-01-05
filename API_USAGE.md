# API Usage Guide

This guide shows how to migrate from localStorage to API calls.

## Quick Reference

### Authentication

**Before (localStorage):**
```typescript
const dealers = JSON.parse(localStorage.getItem("dealers") || "[]")
const foundDealer = dealers.find(d => d.username === username)
```

**After (API):**
```typescript
import { api } from "@/lib/api"

const response = await api.auth.login(username, password)
// Response includes token, user data, etc.
```

### Quotations

**Before (localStorage):**
```typescript
const quotations = JSON.parse(localStorage.getItem("quotations") || "[]")
const dealerQuotations = quotations.filter(q => q.dealerId === dealerId)
localStorage.setItem("quotations", JSON.stringify(updatedQuotations))
```

**After (API):**
```typescript
import { api } from "@/lib/api"

// Get all quotations
const response = await api.quotations.getAll({
  page: 1,
  limit: 20,
  status: "pending"
})
// response.quotations - array of quotations
// response.pagination - pagination info

// Create quotation
const newQuotation = await api.quotations.create({
  customerId: "cust_123",
  products: { ... },
  discount: 5
})

// Update discount
await api.quotations.updateDiscount("QT-123", 10)
```

### Customers

**Before (localStorage):**
```typescript
const customers = JSON.parse(localStorage.getItem("customers") || "[]")
customers.push(newCustomer)
localStorage.setItem("customers", JSON.stringify(customers))
```

**After (API):**
```typescript
import { api } from "@/lib/api"

// Create customer
const customer = await api.customers.create({
  firstName: "John",
  lastName: "Doe",
  mobile: "9876543210",
  email: "john@example.com",
  address: { ... }
})

// Get all customers
const response = await api.customers.getAll({
  page: 1,
  limit: 20,
  search: "John"
})
```

### Visits

**Before (localStorage):**
```typescript
const visits = JSON.parse(localStorage.getItem(`visits_${quotationId}`) || "[]")
visits.push(newVisit)
localStorage.setItem(`visits_${quotationId}`, JSON.stringify(visits))
```

**After (API):**
```typescript
import { api } from "@/lib/api"

// Create visit
const visit = await api.visits.create({
  quotationId: "QT-123",
  visitDate: "2025-12-20",
  visitTime: "14:00",
  location: "123 Main St",
  locationLink: "https://maps.google.com/...",
  visitors: [{ visitorId: "visitor_001" }]
})

// Get visits for quotation
const visits = await api.visits.getByQuotation("QT-123")

// Approve visit
await api.visits.approve("visit_456")

// Complete visit
await api.visits.complete("visit_456", {
  length: 500.50,
  width: 300.25,
  height: 250.75,
  images: ["base64_image_1", "base64_image_2"],
  notes: "Site ready for installation"
})

// Reject visit
await api.visits.reject("visit_456", "Customer not available")
```

### Visitors (Admin)

**Before (localStorage):**
```typescript
const visitors = JSON.parse(localStorage.getItem("visitors") || "[]")
visitors.push(newVisitor)
localStorage.setItem("visitors", JSON.stringify(visitors))
```

**After (API):**
```typescript
import { api } from "@/lib/api"

// Create visitor (Admin only)
const visitor = await api.admin.visitors.create({
  username: "visitor_001",
  password: "securePassword",
  firstName: "Rajesh",
  lastName: "Kumar",
  email: "rajesh@example.com",
  mobile: "9876543210",
  employeeId: "EMP001"
})

// Get all visitors
const response = await api.admin.visitors.getAll({
  page: 1,
  limit: 20,
  isActive: true
})

// Update visitor
await api.admin.visitors.update("visitor_001", {
  firstName: "Rajesh",
  lastName: "Kumar",
  email: "newemail@example.com"
})

// Deactivate visitor
await api.admin.visitors.delete("visitor_001")
```

### Error Handling

```typescript
import { api, ApiError } from "@/lib/api"

try {
  const quotation = await api.quotations.create(data)
} catch (error) {
  if (error instanceof ApiError) {
    console.error("API Error:", error.message)
    console.error("Error Code:", error.code)
    if (error.details) {
      error.details.forEach(detail => {
        console.error(`${detail.field}: ${detail.message}`)
      })
    }
  } else {
    console.error("Unexpected error:", error)
  }
}
```

## Migration Checklist

- [ ] Update authentication to use `api.auth.login()`
- [ ] Replace localStorage quotation operations with `api.quotations.*`
- [ ] Replace localStorage customer operations with `api.customers.*`
- [ ] Replace localStorage visit operations with `api.visits.*`
- [ ] Update admin visitor management to use `api.admin.visitors.*`
- [ ] Add error handling for all API calls
- [ ] Update loading states to handle async operations
- [ ] Test all API endpoints

## Environment Setup

1. Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3050/api
NEXT_PUBLIC_USE_API=true
```

2. The API service automatically:
   - Adds authentication tokens to requests
   - Handles token refresh
   - Redirects to login on 401 errors
   - Provides error handling


