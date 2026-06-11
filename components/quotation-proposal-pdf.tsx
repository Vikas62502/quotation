"use client"

import type { QuotationProposalDocumentData } from "@/lib/quotation-proposal-document"
import {
  formatProposalDate,
  getProposalConsentText,
  getProposalOfficeLocations,
} from "@/lib/quotation-proposal-document"
import { formatPersonName } from "@/lib/name-display"
import { PROPOSAL_PDF_STYLES } from "@/lib/quotation-proposal-pdf-styles"

type Props = {
  data: QuotationProposalDocumentData
  rootId?: string
}

function ProposalFieldTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <table className="prop-field-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="prop-field-label">{row.label}</td>
            <td className="prop-field-value">{row.value || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function QuotationProposalPdf({ data, rootId = "quotation-content" }: Props) {
  const {
    quotationId,
    quotationDate,
    validityDate,
    customer,
    products,
    company,
    dealer,
    banks,
    subtotal,
    systemKwLabel,
    phaseLabel,
    systemTypeLabel,
    specRows,
    panelNote,
    showPricingRateColumn = false,
    pricingRows,
    paymentRows,
    warrantyRows,
    supportLine,
    termsRows,
    page2CompactFont,
  } = data

  const customerAddress = [
    customer.address?.street,
    customer.address?.city,
    customer.address?.state,
    customer.address?.pincode,
  ]
    .filter(Boolean)
    .join(", ")

  const consentText = getProposalConsentText(company.name, products)
  const officeLocations = getProposalOfficeLocations(company)

  return (
    <div id={rootId} className="proposal-pdf-root">
      <style dangerouslySetInnerHTML={{ __html: PROPOSAL_PDF_STYLES }} />

      {/* Page 1 — Proposal + specification */}
      <div className="proposal-pdf-page proposal-pdf-page-1">
        <div className="prop-page-top">
        <div className="prop-header">
          <img src={company.logoUrl || "/placeholder.svg"} alt="ChairBord Solar" crossOrigin="anonymous" />
          <div className="prop-title-block">
            <h1>Solar Installation Proposal</h1>
            <div className="prop-meta">
              <div>
                <strong>Quotation #:</strong> {quotationId}
              </div>
              <div>
                <strong>Updated:</strong> {formatProposalDate(quotationDate)}
              </div>
              <div>
                <strong>Valid Until:</strong> {formatProposalDate(validityDate)}
              </div>
            </div>
          </div>
        </div>

        <hr className="prop-header-rule" />
        <span className="prop-tagline">Green Energy, Bright Future.</span>

        <div className="prop-section-box">
          <div className="prop-bar">■ Proposal Details</div>
          <div className="prop-details-body">
            <div className="prop-details-col">
              <h3>■ Customer Details</h3>
              <ProposalFieldTable
                rows={[
                  {
                    label: "Name:",
                    value: formatPersonName(customer.firstName, customer.lastName, "—"),
                  },
                  { label: "Phone:", value: customer.mobile },
                  { label: "Address:", value: customerAddress },
                  { label: "System Type:", value: systemTypeLabel },
                ]}
              />
            </div>
            <div className="prop-details-col">
              <h3>■ Dealer Details</h3>
              <ProposalFieldTable
                rows={[
                  { label: "Dealer Name:", value: dealer.name },
                  { label: "Contact No.:", value: dealer.contact },
                  { label: "Email:", value: dealer.email },
                  { label: "GSTIN:", value: company.gst },
                ]}
              />
            </div>
          </div>
        </div>
        </div>

        <div className="prop-spec-block">
          <div className="prop-bar">Solar System Specification — {systemKwLabel}</div>
          <div className="prop-subbar">
            System Size: {systemKwLabel} | Phase: {phaseLabel} | Type: {systemTypeLabel}
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
              {specRows.map((row, i) => (
                <tr key={i}>
                  <td className="prop-component-cell">{row.component}</td>
                  <td>{row.specification}</td>
                  <td>{row.brandModel}</td>
                  <td className="col-qty">{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Page 2 — Pricing, payment, bank, warranty */}
      <div
        className={`proposal-pdf-page proposal-pdf-page-2${page2CompactFont ? " proposal-pdf-page-2-compact" : ""}`}
      >
        <div className="prop-p2-body">
        {panelNote ? <div className="prop-p2-intro prop-note-green">{panelNote}</div> : null}

        <div className="prop-p2-section">
          <div className="prop-bar">Pricing Breakdown</div>
          <table
            className={`prop-table${showPricingRateColumn ? "" : " prop-pricing-table-no-rate"}`}
          >
            <thead>
              <tr>
                <th>Description</th>
                {showPricingRateColumn ? <th>Rate</th> : null}
                <th>Capacity</th>
                <th className="col-amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pricingRows.map((row, i) => (
                <tr key={i} className={row.highlight ? "prop-highlight-row" : undefined}>
                  <td>{row.description}</td>
                  {showPricingRateColumn ? <td>{row.rate}</td> : null}
                  <td>{row.capacity}</td>
                  <td className="col-amount">{row.amount}</td>
                </tr>
              ))}
              <tr className="prop-total-row">
                <td colSpan={showPricingRateColumn ? 3 : 2}>
                  TOTAL PROJECT COST (Including GST &amp; All Charges)
                </td>
                <td className="col-amount">₹{subtotal.toLocaleString("en-IN")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="prop-p2-section">
          <div className="prop-bar">Payment Schedule</div>
          <table className="prop-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>When</th>
                <th>Percentage</th>
                <th className="col-amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row, i) => {
                const isTotal = row.stage.toUpperCase() === "TOTAL"
                const rowClass = [
                  row.highlight ? "prop-highlight-row" : "",
                  row.stage.toLowerCase().includes("token") ? "prop-payment-token" : "",
                  isTotal ? "prop-payment-total-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
                return (
                  <tr key={i} className={rowClass || undefined}>
                    <td>{row.stage}</td>
                    <td>{row.when}</td>
                    <td>{row.percentage}</td>
                    <td className="col-amount">{row.amount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="prop-p2-section">
          <div className="prop-bar">Bank Details for Payment</div>
          <div className="prop-bank-grid">
            <div className="prop-bank-box sbi">
              <strong>{banks.sbi.bankName}</strong>
              <p>
                <strong>A/C Name:</strong> {banks.sbi.accountName}
              </p>
              <p>
                <strong>A/C No:</strong> {banks.sbi.accountNumber}
              </p>
              <p>
                <strong>IFSC:</strong> {banks.sbi.ifscCode}
              </p>
            </div>
            <div className="prop-bank-box icici">
              <strong>{banks.icici.bankName}</strong>
              <p>
                <strong>A/C Name:</strong> {banks.icici.accountName}
              </p>
              <p>
                <strong>A/C No:</strong> {banks.icici.accountNumber}
              </p>
              <p>
                <strong>IFSC:</strong> {banks.icici.ifscCode}
              </p>
            </div>
          </div>
        </div>

        <div className="prop-p2-section">
          <div className="prop-bar">Warranty &amp; After-Sales Support</div>
          <table className="prop-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Warranty Period</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {warrantyRows.map((row, i) => (
                <tr key={i}>
                  <td>{row.component}</td>
                  <td>{row.period}</td>
                  <td>{row.coverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="prop-support-line">{supportLine}</p>
        </div>

        <div className="prop-p2-spacer" aria-hidden />
        </div>
      </div>

      {/* Page 3 — Terms, consent & footer (styling matches page 2) */}
      <div className="proposal-pdf-page proposal-pdf-page-3">
        <div className="prop-p3-body">
          <div className="prop-p3-section">
            <div className="prop-bar">Terms &amp; Conditions</div>
            <table className="prop-table">
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Category</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {termsRows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{row.category}</strong>
                    </td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="prop-p3-section">
            <div className="prop-bar">Customer Consent &amp; Acceptance</div>
            <div className="prop-consent">
          <table className="prop-consent-check-table" role="presentation">
            <tbody>
              <tr>
                <td className="prop-consent-check-box-cell">
                  <span className="prop-consent-checkbox" aria-hidden />
                </td>
                <td className="prop-consent-check-text-cell">{consentText}</td>
              </tr>
            </tbody>
          </table>

          <table className="prop-consent-fields-table" role="presentation">
            <tbody>
              <tr>
                <td className="prop-consent-field-cell">Name:</td>
                <td className="prop-consent-field-cell">Relation (if any):</td>
                <td className="prop-consent-field-cell">Date:</td>
              </tr>
            </tbody>
          </table>

          <table className="prop-consent-sign-table" role="presentation">
            <tbody>
              <tr>
                <td className="prop-consent-sign-cell">
                  <div className="prop-consent-sign-inner">
                    <div className="prop-consent-sign-head">Customer (Self)</div>
                    <div className="prop-consent-sign-body">
                      <div className="prop-consent-sign-caption">Signature</div>
                    </div>
                  </div>
                </td>
                <td className="prop-consent-sign-cell prop-consent-sign-cell-center">
                  <div className="prop-consent-sign-inner">
                    <div className="prop-consent-sign-head">For, {company.name}</div>
                    <div className="prop-consent-sign-designation">Designation:</div>
                    <div className="prop-consent-sign-body">
                      <div className="prop-consent-sign-caption">Authorised Signature</div>
                    </div>
                  </div>
                </td>
                <td className="prop-consent-sign-cell">
                  <div className="prop-consent-sign-inner">
                    <div className="prop-consent-sign-head">Office Stamp</div>
                    <div className="prop-consent-sign-body prop-consent-stamp-body" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
            </div>
          </div>

          <div className="prop-p3-spacer" aria-hidden />
        </div>

        <div className="prop-closing">
          <p>Thanking you and assuring you of our best and prompt attention at all times, we remain.</p>
          <p className="sig">Yours faithfully,</p>
          <p className="sig">For, {company.name}</p>
          <div className="prop-offices">
            {officeLocations.map((office) => (
              <p key={office.label}>
                <strong>{office.label}:</strong> {office.address}
              </p>
            ))}
            <p>
              <strong>Mobile:</strong> {company.phone} | <strong>GSTIN:</strong> {company.gst}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
