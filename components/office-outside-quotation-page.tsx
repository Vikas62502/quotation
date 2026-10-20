"use client"

import {
  buildSpecRows,
  formatInr,
  formatProposalDate,
  getSystemKwLabel,
  getSystemTypeLabel,
} from "@/lib/quotation-proposal-document"
import { formatQuotationPhaseLabel, resolveQuotationPhase } from "@/lib/pricing-tables"
import { formatPersonName } from "@/lib/name-display"
import { PROPOSAL_PDF_STYLES } from "@/lib/quotation-proposal-pdf-styles"
import {
  formatOfficeOutsideAddress,
  officeOutsideFileTypeLabel,
  officeOutsideSubtotalAmount,
  type OfficeOutsideRecord,
} from "@/lib/office-outside-accounts"
import type { AdminSubvendorRecord } from "@/lib/admin-subvendors"

type Props = {
  record: OfficeOutsideRecord
  vendor?: Pick<AdminSubvendorRecord, "name" | "contactName" | "mobile" | "email"> | null
  notes?: string
  rootId?: string
  /** Hidden A4 capture target. Visible preview should pass false. */
  hidden?: boolean
}

/**
 * One-page Office Outside quotation.
 * Customer + selected dealer + required product overview. No company / Chairbord branding.
 */
export function OfficeOutsideQuotationPage({
  record,
  vendor,
  notes,
  rootId = "office-outside-quotation-page",
  hidden = true,
}: Props) {
  const customer = record.customer
  const products = record.products
  const customerName = formatPersonName(
    customer?.firstName,
    customer?.lastName,
    record.customerName || "—",
  )
  const address = formatOfficeOutsideAddress(customer) || record.address || "—"
  const specRows = products ? buildSpecRows(products) : []
  const systemKw = products ? getSystemKwLabel(products) : "—"
  const phase = products ? formatQuotationPhaseLabel(resolveQuotationPhase(products)) : "—"
  const systemType = products
    ? getSystemTypeLabel(products.systemType, products.inverterType)
    : "—"
  const dealerName = vendor?.name || record.outsideVendorName || "—"
  const dealerContact = vendor?.contactName || "—"
  const dealerMobile = vendor?.mobile || "—"
  const fileType = officeOutsideFileTypeLabel(record.fileType) || "—"
  const extraNotes = (notes ?? record.requirementSlip?.notes ?? record.notes ?? "").trim()
  const issued = record.updatedAt || record.createdAt
  const quotationDate = issued ? new Date(issued) : new Date()
  const subtotalAmount = officeOutsideSubtotalAmount(record)

  return (
    <div id={rootId} className={hidden ? "proposal-pdf-root" : "office-outside-preview-root"}>
      <style
        dangerouslySetInnerHTML={{
          __html: `${PROPOSAL_PDF_STYLES}
.office-outside-preview-root {
  position: relative;
  left: auto;
  top: auto;
  z-index: auto;
  pointer-events: auto;
  width: 210mm;
  height: 297mm;
}
.office-outside-preview-root .proposal-pdf-page {
  width: 210mm;
  min-height: 297mm;
  max-height: 297mm;
  box-shadow: none;
}
.oo-plain-header {
  text-align: center;
  margin-bottom: 10px;
}
.oo-plain-header h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #1a365d;
}
.oo-plain-header p {
  margin: 4px 0 0;
  font-size: 11px;
  color: #4a5568;
}
`,
        }}
      />
      <div className="proposal-pdf-page proposal-pdf-page-1">
        <div className="prop-page-top">
          <div className="oo-plain-header">
            <h1>Quotation</h1>
            <p>
              #{record.id} · {formatProposalDate(quotationDate)} · File type: {fileType}
            </p>
          </div>
          <hr className="prop-header-rule" />

          <div className="prop-section-box">
            <div className="prop-bar">■ Details</div>
            <div className="prop-details-body">
              <div className="prop-details-col">
                <h3>■ Customer</h3>
                <table className="prop-field-table">
                  <tbody>
                    <tr>
                      <td className="prop-field-label">Name:</td>
                      <td className="prop-field-value">{customerName}</td>
                    </tr>
                    <tr>
                      <td className="prop-field-label">Phone:</td>
                      <td className="prop-field-value">{customer?.mobile || record.mobile || "—"}</td>
                    </tr>
                    <tr>
                      <td className="prop-field-label">Address:</td>
                      <td className="prop-field-value">{address}</td>
                    </tr>
                    <tr>
                      <td className="prop-field-label">File type:</td>
                      <td className="prop-field-value">{fileType}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="prop-details-col">
                <h3>■ Dealer</h3>
                <table className="prop-field-table">
                  <tbody>
                    <tr>
                      <td className="prop-field-label">Dealer Name:</td>
                      <td className="prop-field-value">{dealerName}</td>
                    </tr>
                    <tr>
                      <td className="prop-field-label">Contact:</td>
                      <td className="prop-field-value">{dealerContact}</td>
                    </tr>
                    <tr>
                      <td className="prop-field-label">Phone:</td>
                      <td className="prop-field-value">{dealerMobile}</td>
                    </tr>
                    <tr>
                      <td className="prop-field-label">Subtotal:</td>
                      <td className="prop-field-value">{formatInr(subtotalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="prop-spec-block">
          <div className="prop-bar">Required product overview — {systemKw}</div>
          <div className="prop-subbar">
            System Size: {systemKw} | Phase: {phase} | Type: {systemType}
          </div>
          <table className="prop-table">
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Component</th>
                <th style={{ width: "32%" }}>Specification</th>
                <th style={{ width: "32%" }}>Brand / Model</th>
                <th className="col-qty">Qty</th>
              </tr>
            </thead>
            <tbody>
              {specRows.length === 0 ? (
                <tr>
                  <td colSpan={4}>Complete the quotation form to fill required products.</td>
                </tr>
              ) : (
                specRows.map((row, i) => (
                  <tr key={`${row.component}-${i}`}>
                    <td className="prop-component-cell">{row.component}</td>
                    <td>{row.specification}</td>
                    <td>{row.brandModel}</td>
                    <td className="col-qty">{row.qty}</td>
                  </tr>
                ))
              )}
              <tr className="prop-total-row">
                <td colSpan={3}>Subtotal</td>
                <td className="col-qty">{formatInr(subtotalAmount)}</td>
              </tr>
            </tbody>
          </table>
          {extraNotes ? <div className="prop-p2-intro">{extraNotes}</div> : null}
        </div>
      </div>
    </div>
  )
}
