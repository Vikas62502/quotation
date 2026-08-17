# Backend — Dealer & visitor lists from Admin access checkboxes

**Frontend (live):** Lists follow **Admin → Users** checkboxes (`access[]`), not “everyone in dealers/visitors table”.

**Code:** `app/dashboard/admin/page.tsx` · `app/dashboard/hr/page.tsx` · `components/visit-management-dialog.tsx` · `lib/user-access.ts` · `lib/visitor-assignable-directory.ts` · `lib/quotation-assignable-directory.ts`  
**Related:** `BACKEND_USER_ACCESS.md` (A–D, V, L) · `BACKEND_VISIT_TRANSFER.md` · `BACKEND_MANAGE_DEALERS.md` (F)

---

## Still broken without backend (confirmed)

| Case | Admin UI | HR Select / Manage dealers |
|------|----------|----------------------------|
| **Jagdish** (`jpyadav5793`) — visitor row, checkboxes **Visitor + Quotation** | Visible with Quotation badge | **Missing** on other devices / when HR cannot call admin APIs |

FE workarounds (same-browser Admin sync, soft-merge `/admin/visitors`) are **not enough**: HR tokens often get **403** on admin routes. Backend must ship **L4a** for HR.

---

## Must ship

| # | Deliverable | If missing |
|---|-------------|------------|
| **L1** | Persist `access` / `permissions` on dealers, visitors, account-managers | Checkboxes lost |
| **L2** | Every list/get user row returns `access` + `permissions` | FE cannot filter across devices |
| **L3** | `PUT`/`PATCH` accepts `access` / `permissions` | Admin uncheck does not stick |
| **L4a** | **`GET /hr/dealers?includeAccessUsers=true&access=quotation`** = union (dealers **+ visitors + ops**) for **HR token** | Jagdish missing from HR |
| **L4b** | **`GET /dealers/visitors?includeAccessUsers=true&access=visitor`** = union for visits | Saurav-style missing from Schedule Visit |
| **L5** | HR pool + visit assign reject ineligible ids; **accept visitor/ops uuid** if eligible | Save 400 / wrong pool |
| **L6** | Calling queue / `/visitors/me/visits` by assignee **entity id** + `access`, not `role` only | User never sees leads/visits |

Ship **L4a + L2** first (unblocks HR list). Then L5/L6 so save + queue work for visitor uuids.

---

## Access keys

| Checkbox | `access` value | Lists |
|----------|----------------|-------|
| Quotation | `"quotation"` | HR Select/Manage dealers, Admin dealer filters |
| Visitor | `"visitor"` | Admin Visitors tab, Schedule Visit / Transfer |

Legacy when `access` empty/null:

| `role` | Default |
|--------|---------|
| `dealer` | `["quotation"]` |
| `visitor` | `["visitor"]` |
| admin | `["admin"]` only |

If `access` is **present** and missing the key → **exclude**.

---

## L2) Response shape (every user row)

```json
{
  "id": "uuid",
  "username": "jpyadav5793",
  "firstName": "jagdish prasad",
  "lastName": "yadav",
  "email": "jpyadav5793@gmail.com",
  "mobile": "9571585751",
  "isActive": true,
  "role": "visitor",
  "access": ["visitor", "quotation"],
  "permissions": ["visitor", "quotation"]
}
```

Required on:

```http
GET /api/admin/dealers
GET /api/admin/visitors
GET /api/admin/account-managers
GET /api/hr/dealers
GET /api/dealers/visitors
```

---

## L4a) Quotation-assignable list for HR — **ship this**

### Endpoint (HR must succeed — not admin-only)

```http
GET /api/hr/dealers?isActive=true&includeAccessUsers=true&access=quotation
Authorization: Bearer <hr | access:hr | admin>
```

**Do not** require an admin token. FE today tries `/admin/visitors` as fallback and often gets **403** for HR login.

Aliases (optional):

- `GET /api/hr/assignable-dealers?access=quotation`
- `GET /api/admin/users?access=quotation&isActive=true` (only if HR is allowed to call it)

### Union (who to include)

| Source | Rule |
|--------|------|
| Dealers | `isActive` and (`access` includes `"quotation"` **or** empty access → legacy dealer) |
| **Visitors** | `isActive` and `access` includes `"quotation"` — **Jagdish** |
| Account-managers / ops | `isActive` and `access` includes `"quotation"` |

### Exclude

- `access` present without `"quotation"`
- `isActive === false`
- Admin-only (`["admin"]`)

### Dedupe

By normalized `username` (trim, lower-case, strip trailing `@`).  
If the same person exists in two tables, prefer the row that **has** `"quotation"` and has the richest profile (name/mobile).

### Response

```json
{
  "success": true,
  "data": {
    "dealers": [
      {
        "id": "visitor-uuid-of-jagdish",
        "username": "jpyadav5793",
        "firstName": "jagdish prasad",
        "lastName": "yadav",
        "mobile": "9571585751",
        "email": "jpyadav5793@gmail.com",
        "isActive": true,
        "role": "visitor",
        "access": ["visitor", "quotation"],
        "permissions": ["visitor", "quotation"]
      }
    ]
  }
}
```

Return the **real entity id** (visitor uuid is OK). FE saves that id into `dealerIds[]`.

### Reference sketch

```ts
function hasQuotation(u: { access?: string[]; role?: string }) {
  const access = u.access?.length ? u.access : u.role === "dealer" ? ["quotation"] : []
  return access.includes("quotation")
}

async function listQuotationAssignableForHr() {
  const [dealers, visitors, ops] = await Promise.all([
    db.dealers.findMany({ where: { isActive: true } }),
    db.visitors.findMany({ where: { isActive: true } }),
    db.accountManagers.findMany({ where: { isActive: true } }),
  ])
  return dedupeByUsername(
    [...dealers, ...visitors, ...ops].filter(hasQuotation),
  )
}
```

---

## L4b) Visitor-assignable list (visits)

```http
GET /api/dealers/visitors?isActive=true&includeAccessUsers=true&access=visitor
```

Same union pattern for `"visitor"`. See `BACKEND_VISIT_TRANSFER.md` **V1**.

---

## L5) Enforce on write

### HR pool

```http
PATCH /api/hr/leads/uploads/:uploadId/dealers
{
  "dealerIds": ["visitor-uuid-of-jagdish", "dealer-uuid-…"],
  "mode": "replace"
}
```

1. Each id must pass **L4a** (visitor uuid with quotation = **valid**).
2. Reject others → `400` / `VAL_001`.
3. Do **not** reject solely because id is not in the dealers table.

### Visit assign / transfer

`visitorId` must pass **L4b**. Dealer uuid with visitor access is valid.

---

## L6) Downstream by assignee id

| After | Must work |
|-------|-----------|
| HR pool contains **visitor uuid** (quotation) | Calling-queue `/next` for that user when they open Quotation / calling |
| Visit assigned to **dealer uuid** (visitor access) | `GET /visitors/me/visits` returns it |

Auth: allow if JWT `access` includes the section **or** legacy `role` matches. Do not require `role === "dealer"` / `"visitor"` only.

---

## Auth matrix

| Endpoint | Allow if |
|----------|----------|
| `GET /hr/dealers?access=quotation` (union) | `role` hr **or** `access` includes `hr` **or** admin |
| `GET /admin/visitors` | admin (FE soft-fallback only — **not** required if L4a works) |
| `GET /dealers/visitors` (union) | dealer/admin **or** `access` has `quotation` / `admin` |
| Pool replace | hr + L4a eligibility on each id |
| Visit assign/transfer | quotation ownership + L4b eligibility |

---

## QA

- [ ] Login as **HR** (not admin) → `GET /hr/dealers?includeAccessUsers=true&access=quotation` includes **Jagdish** with `access` containing `quotation`
- [ ] HR Select Dealers + Manage dealers show Jagdish without opening Admin first
- [ ] Uncheck Quotation on Jagdish in Admin → he disappears from HR after refresh on **any** device
- [ ] Save pool with Jagdish’s **visitor** uuid → `200`; he can pull leads from calling queue
- [ ] Save pool with visitor-only (no quotation) id → `400`
- [ ] Saurav (`aman4119`, dealer + Visitor) → Schedule Visit dropdown
- [ ] Every user list row returns `access` / `permissions`

---

## FE compatibility (what FE calls today)

| Action | API |
|--------|-----|
| HR quotation directory | Prefers `GET /hr/dealers?…&access=quotation` (**needs L4a**). Also soft-tries `/admin/visitors`, `/admin/account-managers`, `/dealers/visitors` |
| Visit assignable | `GET /dealers/visitors?includeAccessUsers=true&access=visitor` |
| Persist checkboxes | `PUT` dealers / visitors / account-managers with `access` + `permissions` |
| HR pool save | `PATCH …/dealers` — quotation-eligible ids from **any** table |
| Visit assign/transfer | visitor-eligible `visitorId` from **any** table |

FE same-browser fallback (`quotationAssignableDirectory`) is temporary only — **not** a substitute for L4a.
