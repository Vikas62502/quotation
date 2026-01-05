# Solar Quotation Management System

A comprehensive system for managing solar quotations, visits, customers, dealers, and visitors.

## Features

- **Dealer Management**: Dealers can create quotations, manage customers, and schedule visits
- **Visitor Management**: Visitors can view assigned visits, complete site surveys, and update visit status
- **Admin Panel**: Admin can manage all dealers, visitors, quotations, and system data
- **Visit Management**: Complete visit workflow with location tracking, dimensions, and image uploads

## API Integration

The application can connect to a backend API running at `http://localhost:3050/api`.

### Configuration

1. **Environment Variables**: Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3050/api
NEXT_PUBLIC_USE_API=true
```

2. **API Base URL**: The API base URL can be configured in:
   - Environment variable: `NEXT_PUBLIC_API_URL`
   - Runtime configuration: `lib/api-config.ts`
   - Default: `http://localhost:3050/api`

### API Service

The API service layer is located in `lib/api.ts` and provides methods for:

- **Authentication**: Login, logout, register, change password
- **Dealers**: Profile management, statistics
- **Customers**: CRUD operations
- **Quotations**: Create, read, update, list
- **Visits**: Create, approve, complete, reject, reschedule
- **Visitors**: Get assigned visits, statistics
- **Admin**: Manage dealers, visitors, quotations, statistics

### Usage Example

```typescript
import { api } from "@/lib/api"

// Login
const response = await api.auth.login("username", "password")

// Get quotations
const quotations = await api.quotations.getAll({ status: "pending" })

// Create customer
const customer = await api.customers.create({
  firstName: "John",
  lastName: "Doe",
  // ... other fields
})

// Create visit
const visit = await api.visits.create({
  quotationId: "QT-123",
  visitDate: "2025-12-20",
  visitTime: "14:00",
  location: "123 Main St",
  locationLink: "https://maps.google.com/...",
  visitors: [{ visitorId: "visitor_001" }]
})
```

### Fallback Mode

If `NEXT_PUBLIC_USE_API=false` or the API is unavailable, the application will fall back to using localStorage for data persistence (development mode).

## Getting Started

1. Install dependencies:
```bash
npm install
# or
pnpm install
# or
yarn install
```

2. Configure API (optional):
   - Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3050/api`
   - Or use localStorage fallback by setting `NEXT_PUBLIC_USE_API=false`

3. Run the development server:
```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── dashboard/          # Dashboard pages
│   │   ├── admin/         # Admin panel
│   │   ├── customers/    # Customer management
│   │   └── quotations/    # Quotation management
│   ├── visitor/           # Visitor dashboard
│   └── login/             # Login page
├── components/             # React components
│   ├── ui/                # UI components (shadcn/ui)
│   └── ...                # Feature components
├── lib/                    # Utilities and services
│   ├── api.ts             # API service layer
│   ├── api-config.ts      # API configuration
│   ├── auth-context.tsx   # Authentication context
│   └── ...                # Other utilities
└── public/                 # Static assets
```

## API Endpoints

See `API_SPECIFICATION.txt` for complete API documentation.

## Database Schema

See `DATABASE_SCHEMA.txt` for database structure.

## ER Diagram

See `ER_DIAGRAM.txt` for entity relationships.
