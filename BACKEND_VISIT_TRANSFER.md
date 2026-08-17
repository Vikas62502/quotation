# Backend — Visit dropdown (Visitor checkbox users) + single assign + transfer

**Frontend (live):** Schedule Visit — Visitor-checkbox dropdown; **Schedule Visit** + **Transfer** + **Cancel** on Assign form; Transfer also on visit cards; single assignee  
**Code:** `components/visit-management-dialog.tsx` · `lib/api.ts` (`api.visits.transfer`) · `lib/visitor-assignable-directory.ts`  
**Related:** `BACKEND_USER_ACCESS.md` · `BACKEND_ACCESS_BASED_LISTS.md` · `BACKEND_UNIFIED_USERS_AND_CITY_FILTER.md`

### Bug this fixes

Schedule Visit dropdown showed only legacy visitors (AMAN RAJAK, Jitu001, …).  
**Saurav Verma (`aman4119`)** has Visitor access in Admin → Users but did **not** appear, because `GET /dealers/visitors` returned only the old visitors table.

---

## Must ship

| # | Deliverable | If missing |
|---|-------------|------------|
| **V1** | `GET /dealers/visitors` returns **all active users** with `access` containing **`visitor`** (visitors **+ dealers + ops**) | Checkbox users like `aman4119` missing from dropdown |
| **V2** | Each row includes `access` / `permissions` | FE cannot trust eligibility |
| **V3** | `POST /visits` stores **one** assignee; `visitorId` may be a **dealer id** with visitor access | Assign to Saurav fails / 400 |
| **V4** | `PATCH /visits/:id/transfer` — used by **Assign form Transfer** and **card Transfer** | Transfer fails |
| **V5** | After transfer / assign, `GET /visitors/me/visits` uses assignee id (dealer or visitor) when `access` has `visitor` | Assignee never sees visit |
| **V6** | Auth: `role` **or** `access` (`quotation` for schedule, `visitor` for visitor app) | AUTH_004 |

Until **V1** ships, FE has a browser-only fallback (Admin Users sync). Other devices still need the API.

---

## V1) List assignable visitors (critical)

```http
GET /api/dealers/visitors?isActive=true&includeAccessUsers=true&access=visitor
Authorization: Bearer <dealer | admin | access:quotation>
```

FE also tries: `/dealers/me/visitors`, `/visitors/assignable`, `/visitors` (same query).

### Who to include (union)

| Source | Rule |
|--------|------|
| Visitors table | `isActive` and (`access` empty → treat as `["visitor"]`, or includes `"visitor"`) |
| **Dealers** | `isActive` and `access` includes `"visitor"` — **e.g. Saurav Verma / `aman4119`** with `["quotation","visitor"]` |
| Account-managers / ops | `isActive` and `access` includes `"visitor"` |

### Who to exclude

- `isActive === false`
- `access` present and **does not** include `"visitor"`
- Admin-only (`access: ["admin"]` only)

### Response shape (same for dealers and visitors)

```json
{
  "success": true,
  "data": {
    "visitors": [
      {
        "id": "dealer-or-visitor-uuid",
        "username": "aman4119",
        "firstName": "Saurav",
        "lastName": "Verma",
        "email": "…",
        "mobile": "…",
        "employeeId": null,
        "isActive": true,
        "role": "dealer",
        "access": ["quotation", "visitor"],
        "permissions": ["quotation", "visitor"]
      },
      {
        "id": "visitor-uuid",
        "username": "Jitu001",
        "firstName": "Jitendra",
        "lastName": "Choudhary",
        "isActive": true,
        "role": "visitor",
        "access": ["visitor"],
        "permissions": ["visitor"]
      }
    ]
  }
}
```

Use the user’s real `id` (dealer id or visitor id). Visit assignment must accept that id.

### Reference query sketch

```ts
function hasVisitorAccess(user: { access?: unknown; permissions?: unknown; role?: string }) {
  const access = normalizeAccess(user.access ?? user.permissions)
  if (access.length) return access.includes("visitor")
  const role = String(user.role || "").toLowerCase()
  return role === "visitor" || !role // legacy visitor rows
}

async function listAssignableVisitors() {
  const [visitors, dealers, ops] = await Promise.all([
    db.visitors.findMany({ where: { isActive: true } }),
    db.dealers.findMany({ where: { isActive: true } }),
    db.accountManagers.findMany({ where: { isActive: true } }),
  ])

  return [...visitors, ...dealers, ...ops]
    .filter(hasVisitorAccess)
    .map((u) => ({
      id: u.id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      mobile: u.mobile,
      employeeId: u.employeeId ?? null,
      isActive: u.isActive !== false,
      role: u.role || (u.table === "dealers" ? "dealer" : "visitor"),
      access: normalizeAccess(u.access ?? u.permissions),
      permissions: normalizeAccess(u.access ?? u.permissions),
    }))
}
```

Dedupe by `username` (prefer row that already has `visitor` in `access`).

---

## V3) Schedule visit (single assignee — may be dealer id)

```http
POST /api/visits
```

```json
{
  "quotationId": "uuid",
  "visitDate": "2026-08-13",
  "visitTime": "10:00 - 11:00",
  "visitStartTime": "10:00",
  "visitEndTime": "11:00",
  "visitTimeRange": "10:00 - 11:00",
  "location": "…",
  "locationLink": "optional",
  "notes": "optional",
  "visitors": [{ "visitorId": "dealer-or-visitor-uuid" }]
}
```

Rules:

1. `visitors.length === 1` (or take first only).
2. `visitorId` must pass **V1** eligibility (dealer with visitor access is valid).
3. Persist so list + visitor dashboard resolve that id.

```http
GET /api/quotations/:quotationId/visits
```

Return assigned person under `visitors[]` with `visitorId` / `id` / name fields.

---

## V4) Transfer visit (Assign form + visit card)

**No new endpoint** beyond transfer — FE now has two entry points that call the **same** API:

| UI | User flow |
|----|-----------|
| **Assign Visitor** form → **Transfer** button (next to Schedule Visit / Cancel) | Select target visitor in dropdown → Transfer → confirm (optionally pick which visit if several upcoming) |
| Scheduled visit card → **Transfer** | Opens transfer dialog for that visit |

### API (required)

```http
PATCH /api/visits/:visitId/transfer
Authorization: Bearer <dealer who owns quotation | admin | access:quotation>
Content-Type: application/json
```

```json
{
  "visitorId": "new-assignee-uuid",
  "visitor_id": "new-assignee-uuid",
  "visitorName": "Saurav Verma",
  "visitors": [{ "visitorId": "new-assignee-uuid", "visitorName": "Saurav Verma" }],
  "reason": "optional string"
}
```

### Aliases FE tries (in order)

1. `PATCH /visits/:id/transfer`
2. `PATCH /visits/:id/reassign`
3. `PATCH /dealers/visits/:id/transfer`
4. `PATCH /dealers/me/visits/:id/transfer`
5. Fallback: `PATCH /visits/:id` with `{ visitors, visitorId }`

Implement **at least** `/visits/:id/transfer` or the PATCH fallback.

### Behaviour

1. Replace **all** previous assignees with the new single **V1-eligible** user (`visitorId` may be dealer or visitor uuid).
2. Reject if new id equals current assignee, inactive, or no `visitor` access → `400` / `VAL_001`.
3. Keep quotation, date, time, location; optionally append `reason` to notes / audit.
4. Old assignee must **not** see the visit on `GET /visitors/me/visits`; new assignee must.
5. Auth: same as create visit (quotation owner / admin / `access: quotation`).

### Success

```json
{
  "success": true,
  "data": {
    "id": "visit-uuid",
    "visitors": [{ "visitorId": "new-assignee-uuid", "fullName": "Saurav Verma" }]
  }
}
```

### FE list dependency

Form Transfer needs upcoming visits from:

```http
GET /api/quotations/:quotationId/visits
```

Each visit must include current `visitors[]` so FE can show “Current visitor” and avoid no-op transfers.

---

## V5) Visitor dashboard for dealer-with-visitor-access

When user logs in with `access` including `visitor` (even if `role` is `dealer`):

```http
GET /api/visitors/me/visits?status=all
```

Must return visits where assignment `visitorId` equals that user’s id (dealer uuid if assigned as dealer).

Do **not** require `role === "visitor"` only.

---

## Auth

| Endpoint | Allow if |
|----------|----------|
| `GET /dealers/visitors` | dealer/admin **or** `access` has `quotation` / `admin` |
| `POST /visits`, `PATCH …/transfer` | same + can manage that quotation |
| `GET /visitors/me/visits` | `role === visitor` **or** `access` includes `visitor` |

---

## QA

- [ ] Admin checks Visitor on **Saurav / aman4119** → appears in Schedule Visit dropdown for any dealer
- [ ] Uncheck Visitor → disappears after refresh
- [ ] Legacy visitors (e.g. Jitu001) still appear
- [ ] Assign visit to Saurav → he sees it after login (Visitor / multi-access)
- [ ] **Form Transfer:** select Saurav → Transfer → visit moves to Saurav; previous assignee loses it
- [ ] **Card Transfer:** same API, works from scheduled visit row
- [ ] Transfer to user without visitor access → 400
- [ ] Transfer when no upcoming visits → FE blocks (no API call)

---

## FE compatibility

| Action | API |
|--------|-----|
| Dropdown | `GET /dealers/visitors?isActive=true&includeAccessUsers=true&access=visitor` |
| Schedule | `POST /visits` · `visitors: [{ visitorId }]` (dealer or visitor uuid) |
| List | `GET /quotations/:id/visits` |
| Transfer (form button **or** card) | `PATCH /visits/:id/transfer` (+ aliases) — **same body** |
| Assignee app | `GET /visitors/me/visits` by assignee id + `access: visitor` |

FE fallback for dropdown (not a substitute for V1): local directory from Admin → Users on the same browser.
