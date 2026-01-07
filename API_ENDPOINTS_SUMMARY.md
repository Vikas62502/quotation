# API Endpoints Summary

Base URL: `http://localhost:3050/api`

## Authentication & Authorization

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/auth/login` | No | Login with username/password |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/logout` | Yes | Logout current session |
| PUT | `/auth/change-password` | Yes | Change user password |

## Dealers API

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/dealers/register` | No | Register new dealer (public) |
| GET | `/dealers/me` | Yes | Get dealer profile |
| PUT | `/dealers/me` | Yes | Update dealer profile |
| GET | `/dealers/me/statistics` | Yes | Get dealer statistics |

## Customers API

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/customers` | Yes | Create new customer |
| GET | `/customers` | Yes | Get all customers (paginated) |
| GET | `/customers/{customerId}` | Yes | Get customer by ID |
| PUT | `/customers/{customerId}` | Yes | Update customer |

## Quotations API

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/quotations` | Yes | Create new quotation |
| GET | `/quotations` | Yes | Get all quotations (paginated) |
| GET | `/quotations/{quotationId}` | Yes | Get quotation by ID |
| PATCH | `/quotations/{quotationId}/discount` | Yes | Update quotation discount |
| GET | `/quotations/{quotationId}/pdf` | Yes | Download quotation PDF |

## Visits API

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/visits` | Yes | Create new visit |
| GET | `/quotations/{quotationId}/visits` | Yes | Get visits for quotation |
| PATCH | `/visits/{visitId}/approve` | Yes (Visitor) | Approve visit |
| PATCH | `/visits/{visitId}/complete` | Yes (Visitor) | Complete visit with dimensions/images |
| PATCH | `/visits/{visitId}/incomplete` | Yes (Visitor) | Mark visit as incomplete |
| PATCH | `/visits/{visitId}/reschedule` | Yes (Visitor) | Reschedule visit |
| PATCH | `/visits/{visitId}/reject` | Yes (Visitor) | Reject visit |
| DELETE | `/visits/{visitId}` | Yes | Delete visit |

## Visitors API

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/visitors/me/visits` | Yes (Visitor) | Get assigned visits |
| GET | `/visitors/me/statistics` | Yes (Visitor) | Get visitor statistics |

## Admin API

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/admin/quotations` | Yes (Admin) | Get all quotations |
| PATCH | `/admin/quotations/{quotationId}/status` | Yes (Admin) | Update quotation status |
| GET | `/admin/dealers` | Yes (Admin) | Get all dealers |
| GET | `/admin/statistics` | Yes (Admin) | Get system statistics |
| POST | `/admin/visitors` | Yes (Admin) | Create new visitor |
| GET | `/admin/visitors` | Yes (Admin) | Get all visitors |
| GET | `/admin/visitors/{visitorId}` | Yes (Admin) | Get visitor by ID |
| PUT | `/admin/visitors/{visitorId}` | Yes (Admin) | Update visitor |
| PUT | `/admin/visitors/{visitorId}/password` | Yes (Admin) | Update visitor password |
| DELETE | `/admin/visitors/{visitorId}` | Yes (Admin) | Deactivate visitor |

## System Config API

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/config/products` | Yes | Get product catalog |
| GET | `/config/states` | Yes | Get Indian states list |

## Request/Response Format

All requests use JSON format with `Content-Type: application/json` header.

All responses follow this structure:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": [
      {
        "field": "fieldName",
        "message": "Field-specific error"
      }
    ]
  }
}
```

## Authentication

Most endpoints require authentication via Bearer token:
```
Authorization: Bearer {token}
```

Tokens are obtained via `/auth/login` endpoint.

## Pagination

List endpoints support pagination:
- `page` (default: 1)
- `limit` (default: 20, max: 100)

Response includes pagination object:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Error Codes

See `API_SPECIFICATION.txt` Section 9 for complete error code list.

Common codes:
- `AUTH_001`: Invalid credentials
- `AUTH_002`: Token expired
- `AUTH_003`: Invalid token
- `VAL_001`: Validation error
- `VAL_002`: Required field missing
- `RES_001`: Resource not found
- `SYS_001`: Internal server error



