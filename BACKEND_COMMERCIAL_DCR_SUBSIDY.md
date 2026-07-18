# Backend — Commercial DCR/BOTH must NOT require `centralSubsidy` (Jul 2026)

## Problem

Commercial DCR / BOTH quotations get rejected with:

```
centralSubsidy is required for dcr and both system types
```

> **The rule fires on MULTIPLE endpoints.** The current failing call (per frontend stack
> trace) is **`PATCH /api/quotations/:id/products`** — it runs *before* the pricing PATCH.
> The same guard must be relaxed on **every** write path (see §5), not just create/pricing.

Commercial projects have **no subsidy** — `centralSubsidy` and `stateSubsidy` are legitimately `0`.
The rule that requires a positive `centralSubsidy` for `dcr` / `both` must be skipped when the
quotation is flagged commercial.

## What the frontend now sends

The commercial flag is sent on **both** the create payload root and nested `products`, and the
pricing PATCH body, in three interchangeable spellings (accept any):

- `pdfCommercialSet` (boolean)
- `pdf_commercial_set` (boolean)
- `isCommercial` (boolean)

Create payload (`POST /api/quotations`):

```json
{
  "subtotal": 850000,
  "totalAmount": 850000,
  "finalAmount": 850000,
  "centralSubsidy": 0,
  "stateSubsidy": 0,
  "pdfCommercialSet": true,
  "pdf_commercial_set": true,
  "isCommercial": true,
  "products": {
    "systemType": "dcr",
    "pdfCommercialSet": true,
    "pdf_commercial_set": true,
    "isCommercial": true,
    "centralSubsidy": 0,
    "stateSubsidy": 0
  }
}
```

Pricing update (`PATCH /api/quotations/:id/pricing`):

```json
{
  "subtotal": 850000,
  "centralSubsidy": 0,
  "stateSubsidy": 0,
  "totalAmount": 850000,
  "finalAmount": 850000,
  "pdfCommercialSet": true,
  "pdf_commercial_set": true,
  "isCommercial": true
}
```

## Required backend changes

### 1. Helper — detect commercial

```ts
function isCommercialQuotation(req: Request): boolean {
  const b = req.body ?? {};
  const p = b.products ?? {};
  const truthy = (v: unknown) => v === true || v === "true";
  return (
    truthy(b.pdfCommercialSet) || truthy(b.pdf_commercial_set) || truthy(b.isCommercial) ||
    truthy(p.pdfCommercialSet) || truthy(p.pdf_commercial_set) || truthy(p.isCommercial)
  );
}
```

### 2. Skip the subsidy requirement for commercial (create + any pricing validation)

Wherever the current check lives (controller or Joi/express-validator schema), guard it:

```ts
const commercial = isCommercialQuotation(req);
const systemType = String(products?.systemType || "").toLowerCase();

// OLD: rejected dcr/both when centralSubsidy <= 0
if (!commercial && (systemType === "dcr" || systemType === "both")) {
  if (!centralSubsidy || Number(centralSubsidy) <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: "VAL_SUBSIDY",
        message: "centralSubsidy is required for dcr and both system types",
      },
    });
    return;
  }
}
```

> If the rule is in a validation schema (Joi/Yup/express-validator), make the
> `centralSubsidy` requirement conditional: required **only when** `systemType` is
> `dcr`/`both` **and** the commercial flag is falsy.

### 3. Force subsidy to 0 and do not deduct it for commercial

In the pricing normalization (`finalPricing` in `createQuotation`, and the equivalent in the
pricing PATCH handler):

```ts
const commercial = isCommercialQuotation(req);

const finalPricing = {
  ...pricing,
  subtotal: validatedSubtotal,
  // Commercial: no subsidy backfill (no 78000 default), always 0.
  centralSubsidy: commercial
    ? 0
    : Number(centralSubsidy || req.body.pricing?.centralSubsidy || products?.centralSubsidy || 0),
  stateSubsidy: commercial
    ? 0
    : Number(stateSubsidy || req.body.pricing?.stateSubsidy || products?.stateSubsidy || 0),
  totalSubsidy: 0, // recomputed below
  amountAfterSubsidy: 0, // recomputed below
  discountAmount: Number(discountAmount || req.body.pricing?.discountAmount || 0),
  totalAmount: validatedTotalAmount,
  finalAmount: validatedFinalAmount,
};

finalPricing.totalSubsidy = finalPricing.centralSubsidy + finalPricing.stateSubsidy;

// Commercial: amountAfterSubsidy = subtotal (no subsidy deducted), finalAmount = subtotal - discount.
finalPricing.amountAfterSubsidy = commercial
  ? finalPricing.subtotal
  : finalPricing.subtotal - finalPricing.totalSubsidy;
```

### 4. Persist and round-trip the commercial flag

- Store `pdfCommercialSet` / `pdf_commercial_set` inside the quotation `products` JSONB
  (same flow as `pdfPanelRangeKey` — see `BACKEND_CHANGES_REQUIRED.md` §2.1.1).
- Return it unchanged on `GET /api/quotations` and `GET /api/quotations/:id`.
- On uncheck, accept `false` and clear it.

### 5. Apply to all write paths

Make the same guard + normalization apply to **all** of these (the products PATCH is the one
currently throwing):

- `PATCH /api/quotations/:id/products` — **currently failing.** Frontend sends
  `pdf_commercial_set: true` (+ `pdfCommercialSet`) and `centralSubsidy: 0` in the products body.
  Skip the subsidy requirement here when the commercial flag is set.
- `POST /api/quotations` (create)
- `PATCH /api/quotations/:id/pricing` (edit — "Edit System Configuration" dialog)

Whether the rule lives in each controller or in a shared validation schema/middleware, the
commercial short-circuit must run on all of them.

## Acceptance

1. Create a **DCR commercial** quotation with `centralSubsidy: 0` → **201**, no `VAL_SUBSIDY` error.
2. Stored `centralSubsidy = 0`, `stateSubsidy = 0`, `totalSubsidy = 0`.
3. `amountAfterSubsidy === subtotal`; `finalAmount === subtotal - discount`.
4. Non-commercial DCR/BOTH with `centralSubsidy: 0` → still rejected (rule unchanged).
5. `GET` returns `pdfCommercialSet: true` inside `products`.
