/** Inlined for PDF capture (iframe clone does not include Next/styled-jsx). */
export const PROPOSAL_PDF_STYLES = `
.proposal-pdf-root {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: -1;
  pointer-events: none;
}
.proposal-pdf-page {
  width: 210mm;
  min-height: 297mm;
  max-height: 297mm;
  box-sizing: border-box;
  padding: 10mm 12mm;
  background: #ffffff;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12.5px;
  color: #1a202c;
  line-height: 1.4;
  overflow: hidden;
  page-break-after: always;
}
/* Page 1 — stretch sections to use full A4 height */
.proposal-pdf-page-1 {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.proposal-pdf-page-1 .prop-page-top {
  flex: 0 0 auto;
}
.proposal-pdf-page-1 .prop-spec-block {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.proposal-pdf-page-1 .prop-spec-block .prop-table {
  flex: 1 1 auto;
}
.proposal-pdf-page-1 .prop-spec-block .prop-table tbody tr td {
  padding-top: 9px;
  padding-bottom: 9px;
}
.proposal-pdf-page:last-child {
  page-break-after: auto;
}
.prop-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}
.prop-header img {
  height: 56px;
  width: auto;
  object-fit: contain;
}
.prop-title-block {
  text-align: right;
  flex: 1;
  margin-left: 12px;
}
.prop-title-block h1 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: #1a365d;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.prop-meta {
  font-size: 12px;
  line-height: 1.55;
}
.prop-meta div {
  color: #c05621;
}
.prop-meta strong {
  color: #1a365d;
  font-weight: 700;
}
.prop-header-rule {
  height: 3px;
  background: #ed8936;
  border: none;
  margin: 12px 0 12px;
}
.prop-tagline {
  display: block;
  text-align: center;
  font-size: 13px;
  color: #c05621;
  font-weight: 600;
  font-style: italic;
  margin: 0 0 16px;
}
.prop-bar {
  background: #1a365d;
  color: #ffffff;
  font-weight: 700;
  font-size: 12.5px;
  padding: 9px 12px;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.prop-section-box {
  border: 1px solid #cbd5e0;
  margin-bottom: 16px;
  overflow: hidden;
}
.prop-details-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #ffffff;
}
.prop-details-col {
  padding: 12px 14px 14px;
  border-right: 1px solid #e2e8f0;
}
.prop-details-col:last-child {
  border-right: none;
}
.prop-details-col h3 {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: #c05621;
  font-weight: 700;
  text-transform: uppercase;
}
.prop-field-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
}
.prop-field-table tr {
  border-bottom: 1px solid #e2e8f0;
}
.prop-field-table tr:last-child {
  border-bottom: none;
}
.prop-field-label {
  width: 36%;
  background: #edf2f7;
  color: #1a365d;
  font-weight: 700;
  padding: 8px 10px;
  border-right: 1px solid #e2e8f0;
  vertical-align: top;
}
.prop-field-value {
  padding: 8px 10px;
  color: #2d3748;
  background: #ffffff;
  vertical-align: top;
}
.prop-spec-block {
  margin-bottom: 0;
}
.prop-spec-block .prop-bar {
  margin-bottom: 0;
}
.prop-spec-block .prop-subbar {
  margin-bottom: 0;
  border-bottom: none;
}
.prop-spec-block .prop-table {
  margin-top: 0;
}
.prop-table .prop-component-cell {
  font-weight: 700;
  color: #1a365d;
}
.prop-subbar {
  background: #fef3c7;
  border: 1px solid #f6ad55;
  padding: 9px 12px;
  font-size: 11.5px;
  margin-bottom: 8px;
  text-align: center;
  color: #744210;
  font-style: italic;
}
.prop-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
  margin-bottom: 10px;
}
.prop-table th {
  background: #1a365d;
  color: #ffffff;
  font-weight: 700;
  padding: 9px 10px;
  text-align: left;
  border: 1px solid #1a365d;
  font-size: 12px;
}
.prop-table td {
  border: 1px solid #cbd5e0;
  padding: 8px 10px;
  vertical-align: top;
  color: #2d3748;
  line-height: 1.45;
}
.prop-spec-block .prop-table tbody tr td:nth-child(2),
.prop-spec-block .prop-table tbody tr td:nth-child(3) {
  white-space: pre-line;
}
.prop-table tbody tr:nth-child(even) td {
  background: #f7fafc;
}
.prop-table .col-qty {
  text-align: center;
  width: 14%;
}
.prop-table .col-amount {
  text-align: right;
}
.prop-note-green {
  background: #f0fff4;
  border: 1px solid #48bb78;
  padding: 10px 12px;
  font-size: 11.5px;
  margin-bottom: 12px;
  color: #22543d;
  line-height: 1.45;
}
.prop-total-row td {
  background: #ed8936 !important;
  color: #ffffff !important;
  font-weight: 700;
  border-color: #ed8936 !important;
}
.prop-highlight-row td {
  background: #fef3c7 !important;
}
.prop-payment-token td {
  background: #f0fff4 !important;
}
.prop-bank-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}
.prop-bank-box {
  border: 1px solid #cbd5e0;
  padding: 10px 12px;
  font-size: 11.5px;
  line-height: 1.45;
}
.prop-bank-box p {
  margin: 0 0 3px;
}
.prop-bank-box strong {
  color: #1a365d;
}
.prop-bank-box.icici {
  background: #ebf8ff;
}
.prop-bank-box.sbi {
  background: #f0fff4;
}
.prop-closing {
  text-align: center;
  margin-top: 16px;
  font-size: 11.5px;
  color: #2d3748;
}
.prop-closing p {
  margin: 0 0 8px;
}
.prop-closing .sig {
  font-weight: 700;
  margin-top: 12px;
  color: #1a365d;
  font-size: 12px;
}
.prop-offices {
  margin-top: 14px;
  font-size: 10.5px;
  color: #4a5568;
  line-height: 1.5;
  text-align: center;
}
/* Page 2 — even section gaps, bar flush to table */
.proposal-pdf-page-2 {
  display: flex;
  flex-direction: column;
  font-size: 12.5px;
}
.proposal-pdf-page-2 .prop-p2-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
}
.proposal-pdf-page-2 .prop-p2-intro {
  margin: 0;
}
.proposal-pdf-page-2 .prop-p2-section {
  flex: 0 0 auto;
}
.proposal-pdf-page-2 .prop-p2-section .prop-bar {
  margin-bottom: 0;
}
.proposal-pdf-page-2 .prop-p2-section .prop-table {
  margin-top: 0;
  margin-bottom: 0;
}
.proposal-pdf-page-2 .prop-p2-section .prop-bank-grid {
  margin-top: 0;
  margin-bottom: 0;
}
.proposal-pdf-page-2 .prop-p2-spacer {
  flex: 1 1 auto;
  min-height: 0;
}
.proposal-pdf-page-2 .prop-pricing-table-no-rate thead th:nth-child(1) {
  width: 48%;
}
.proposal-pdf-page-2 .prop-pricing-table-no-rate thead th:nth-child(2) {
  width: 22%;
}
.proposal-pdf-page-2 .prop-pricing-table-no-rate thead th.col-amount {
  width: 30%;
}
.proposal-pdf-page-2 .prop-table th {
  padding: 9px 11px;
  font-size: 12px;
}
.proposal-pdf-page-2 .prop-table td {
  padding: 9px 11px;
  font-size: 11.5px;
  line-height: 1.45;
}
.proposal-pdf-page-2 .prop-support-line {
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  background: #f7fafc;
  font-size: 11px;
  line-height: 1.45;
  color: #1a365d;
  white-space: nowrap;
}
.proposal-pdf-page-2 .prop-table tbody tr.prop-row-pad td {
  padding-top: 12px;
  padding-bottom: 12px;
  background: #ffffff;
  font-weight: 400;
}
.proposal-pdf-page-2 .prop-payment-total-row td {
  font-weight: 700;
  background: #f7fafc !important;
}
.proposal-pdf-page-2 .prop-bank-grid {
  gap: 10px;
}
.proposal-pdf-page-2 .prop-bank-box {
  padding: 12px 14px;
  font-size: 11.5px;
  min-height: 88px;
}
.proposal-pdf-page-2 .prop-bank-box p {
  margin: 0 0 5px;
}
.proposal-pdf-page-2 .prop-bank-box p:last-child {
  margin-bottom: 0;
}
.proposal-pdf-page-2 .prop-note-green {
  font-size: 11.5px;
  padding: 11px 13px;
  line-height: 1.45;
  white-space: pre-line;
}
/* Page 3 — same typography & section rhythm as page 2 */
.proposal-pdf-page-3 {
  display: flex;
  flex-direction: column;
  font-size: 11.5px;
}
.proposal-pdf-page-3 .prop-p3-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
}
.proposal-pdf-page-3 .prop-p3-section {
  flex: 0 0 auto;
}
.proposal-pdf-page-3 .prop-p3-section .prop-bar {
  margin-bottom: 0;
}
.proposal-pdf-page-3 .prop-p3-section .prop-table {
  margin-top: 0;
  margin-bottom: 0;
}
.proposal-pdf-page-3 .prop-p3-spacer {
  flex: 1 1 auto;
  min-height: 0;
}
.proposal-pdf-page-3 .prop-table th {
  padding: 8px 10px;
  font-size: 11px;
}
.proposal-pdf-page-3 .prop-table tbody tr td:nth-child(2) {
  white-space: pre-line;
}
.proposal-pdf-page-3 .prop-table td {
  padding: 8px 10px;
  font-size: 10.5px;
  line-height: 1.4;
}
.proposal-pdf-page-3 .prop-consent {
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  padding: 10px 12px;
  margin-top: 0;
  background: #ffffff;
  font-size: 10.5px;
  color: #2d3748;
}
.proposal-pdf-page-3 .prop-consent-check-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}
.prop-consent-check-box-cell {
  width: 28px;
  vertical-align: top;
  padding: 2px 10px 0 0;
}
.prop-consent-checkbox {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #1a365d;
  border-radius: 2px;
  background: #fff;
  box-sizing: border-box;
}
.proposal-pdf-page-3 .prop-consent-check-text-cell {
  vertical-align: top;
  font-size: 10.5px;
  line-height: 1.45;
  color: #2d3748;
  text-align: justify;
}
.proposal-pdf-page-3 .prop-consent-fields-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  table-layout: fixed;
  font-size: 10.5px;
}
.proposal-pdf-page-3 .prop-consent-field-cell {
  vertical-align: middle;
  padding: 0 10px 0 0;
  width: 33.33%;
  font-size: 10.5px;
  font-weight: 700;
  color: #1a365d;
}
.proposal-pdf-page-3 .prop-consent-field-cell:last-child {
  padding-right: 0;
}
.proposal-pdf-page-3 .prop-consent-sign-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.proposal-pdf-page-3 .prop-consent-sign-table td {
  padding: 0 5px;
  vertical-align: top;
}
.proposal-pdf-page-3 .prop-consent-sign-table td:first-child {
  padding-left: 0;
}
.proposal-pdf-page-3 .prop-consent-sign-table td:last-child {
  padding-right: 0;
}
.proposal-pdf-page-3 .prop-consent-sign-cell {
  width: 33.33%;
  vertical-align: top;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  padding: 0;
  background: #fff;
  box-sizing: border-box;
}
.proposal-pdf-page-3 .prop-consent-sign-cell-center {
  border-color: #1a365d;
  border-width: 1.5px;
}
.proposal-pdf-page-3 .prop-consent-sign-inner {
  display: flex;
  flex-direction: column;
  min-height: 108px;
  padding: 10px 8px;
  box-sizing: border-box;
}
.proposal-pdf-page-3 .prop-consent-sign-cell-center .prop-consent-sign-inner {
  min-height: 118px;
}
.proposal-pdf-page-3 .prop-consent-sign-head {
  font-size: 10.5px;
  font-weight: 700;
  color: #1a365d;
  text-align: center;
  line-height: 1.45;
  margin-bottom: 6px;
  flex-shrink: 0;
}
.proposal-pdf-page-3 .prop-consent-sign-designation {
  font-size: 10px;
  font-weight: 700;
  color: #1a365d;
  margin-bottom: 6px;
  text-align: left;
  flex-shrink: 0;
}
.proposal-pdf-page-3 .prop-consent-sign-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 48px;
}
.proposal-pdf-page-3 .prop-consent-sign-caption {
  font-size: 9.5px;
  color: #4a5568;
  text-align: center;
  font-weight: 600;
  line-height: 1.4;
  padding: 4px 2px 2px;
}
.proposal-pdf-page-3 .prop-consent-stamp-body {
  flex: 1 1 auto;
  min-height: 52px;
  border: 1.5px dashed #cbd5e0;
  border-radius: 4px;
  background: #f7fafc;
  margin-top: 4px;
}
.proposal-pdf-page-3 .prop-closing {
  flex: 0 0 auto;
  margin-top: 0;
}
.proposal-pdf-page-3 .prop-closing p {
  font-size: 10.5px;
  line-height: 1.4;
  margin: 0 0 4px;
}
.proposal-pdf-page-3 .prop-closing .sig {
  font-size: 10.5px;
}
.prop-offices p {
  margin: 0 0 3px;
  font-size: 9.5px;
  line-height: 1.35;
}
.prop-offices strong {
  color: #1a365d;
}
.proposal-pdf-rendering .proposal-pdf-page {
  box-shadow: none;
}
`
