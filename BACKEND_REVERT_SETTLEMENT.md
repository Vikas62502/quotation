# Backend handoff — Revert Final Settlement (Jul 2026)

**Frontend:** Account Management → Payment Management → **Manage** → **Revert settlement**  
**API client:** `lib/api.ts` → `api.quotations.revertSettlement`  
**Related apply flow:** `BACKEND_FINAL_SETTLEMENT.md` / `BACKEND_FINAL_SETTLEMENT.ts`

## Why

Account Management sometimes applies settlement / discount `d` by mistake (e.g. Chanda Devi: −₹197,000 d). They need to **undo** it so payable subtotal and remaining return to pre-settlement values. Installment paid amounts are **unchanged**.

## Math (mirror of apply, reversed)

```
settlementAmount = finalSettlementAmount (preferred) OR current discountAmount `d`
discountAmount   = max(0, existingDiscount - settlementAmount)
finalAmount      = max(0, amountAfterSubsidy - discountAmount)
paid             = SUM(installment.paidAmount)          ← UNCHANGED
remaining        = max(0, amCap - discountAmount - paid)
paymentStatus    = remaining<=0 && paid>0 ? completed
                 : paid>0 ? partial : pending
finalSettlementApplied = false
finalSettlementAmount  = 0
finalSettlementAt      = null
```

Example (Chanda Devi style):

| | Before revert | After revert |
|--|---------------|--------------|
| Original subtotal | ₹325,000 | ₹325,000 |
| Discount `d` | ₹197,000 | ₹0 |
| Net / cap | ₹128,000 | ₹325,000 |
| Paid | ₹100,000 | ₹100,000 |
| Remaining | ₹28,000 | ₹225,000 |
| Status | partial | partial |
| `finalSettlementApplied` | true / amount>0 | **false** / **0** |

## Preferred endpoint

```http
POST /api/quotations/{id}/revert-final-settlement
Authorization: Bearer <account-management|admin>
Content-Type: application/json

{
  "amount": 197000,
  "settlementAmount": 197000,
  "discountAmount": 0,
  "finalAmount": 325000,
  "paymentStatus": "partial",
  "remaining": 225000,
  "remainingAmount": 225000,
  "finalSettlementApplied": false,
  "finalSettlementAmount": 0
}
```

**Also accept** (client fallbacks):

| Method | Path | Notes |
|--------|------|--------|
| `DELETE` | `/quotations/:id/final-settlement` | Same body as above |
| `PATCH` | `/quotations/:id/pricing` | `{ discountAmount, totalAmount, finalAmount }` |
| `PATCH` | `/quotations/:id/payment-details` | Clear flags + remaining + status (**no** installment rewrite) |
| `PATCH` | `/quotations/:id/discount` | Absolute `discountAmount` + clear settlement flags |

## Required persistence

1. Set `final_settlement_applied = false`, `final_settlement_amount = 0`, clear `final_settlement_at` / `final_settlement_by`.
2. Set `discount_amount` / `pricing.discountAmount` to the **new** absolute discount (usually `0` if settlement was the only discount).
3. Set `remaining` / `remaining_amount` and `payment_status` from the math above.
4. **Do not** delete or rewrite installment rows / paid amounts.
5. Echo the cleared flags on every subsequent `GET /quotations` and `GET /quotations/:id`.

## Auth

Same as apply: `account-management` or `admin`; quotation `status = approved`.

## Handler sketch

```js
async function postRevertFinalSettlement(req, res) {
  const quotation = await Quotation.findByPk(req.params.id)
  if (!quotation) return res.status(404).json({ success: false, error: { message: 'Not found' } })

  const settlementAmount = Math.round(Number(req.body.settlementAmount ?? req.body.amount ?? quotation.finalSettlementAmount ?? 0) || 0)
  const existingDiscount = Math.round(Number(quotation.discountAmount ?? quotation.pricing?.discountAmount ?? 0) || 0)
  const discountAmount = Math.max(
    0,
    Number.isFinite(Number(req.body.discountAmount))
      ? Math.round(Number(req.body.discountAmount))
      : existingDiscount - settlementAmount,
  )

  const amountAfterSubsidy = Number(quotation.amountAfterSubsidy ?? quotation.pricing?.amountAfterSubsidy ?? quotation.subtotal) || 0
  const finalAmount = Math.max(0, Number(req.body.finalAmount) || amountAfterSubsidy - discountAmount)

  const paid = sumPaid(quotation)
  const remaining = Math.max(
    0,
    Number.isFinite(Number(req.body.remaining))
      ? Math.round(Number(req.body.remaining))
      : finalAmount - paid, // or AM cap - discount - paid
  )
  const paymentStatus =
    req.body.paymentStatus ||
    (remaining <= 0 && paid > 0 ? 'completed' : paid > 0 ? 'partial' : 'pending')

  await quotation.update({
    discountAmount,
    remaining,
    remainingAmount: remaining,
    paymentStatus,
    finalSettlementApplied: false,
    finalSettlementAmount: 0,
    finalSettlementAt: null,
    finalSettlementBy: null,
    pricing: {
      ...(quotation.pricing || {}),
      discountAmount,
      totalAmount: finalAmount,
      finalAmount,
      finalSettlementApplied: false,
      finalSettlementAmount: 0,
    },
  })

  return res.json({ success: true, data: quotationToApiJson(quotation) })
}
```

Register:

```js
router.post('/quotations/:id/revert-final-settlement', authRequired, postRevertFinalSettlement)
router.delete('/quotations/:id/final-settlement', authRequired, postRevertFinalSettlement)
```

## QA

1. Open Manage on a row with `− ₹… d` (e.g. Chanda Devi).
2. Click **Revert settlement** → confirm → **200**.
3. Refresh: discount `d` gone, subtotal restored, remaining = net − paid, status partial/pending as expected.
4. `GET` shows `finalSettlementApplied: false`, `finalSettlementAmount: 0`.
5. Paid installment totals unchanged.
6. Can apply **Submit final settlement** again later if needed.

## Client call order

See `lib/api.ts` → `revertSettlement`:

1. `POST /revert-final-settlement`
2. `DELETE /final-settlement`
3. `PATCH /pricing` + `PATCH /payment-details`
4. `PATCH /discount`
5. Verify with `GET /quotations/:id` — throws if flags/discount not cleared
