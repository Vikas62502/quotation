"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Check } from "lucide-react"
import { CustomerDetailsForm } from "@/components/customer-details-form"
import { ProductSelectionForm } from "@/components/product-selection-form"
import { QuotationConfirmation } from "@/components/quotation-confirmation"
import type { Customer, ProductSelection } from "@/lib/quotation-context"
import {
  createOfficeOutsideRecord,
  customerFromOfficeOutsideRecord,
  snapshotFromOfficeOutsideForm,
  updateOfficeOutsideRecord,
  officeOutsideRecordToApiBody,
  pickOfficeOutsideRecordFromApi,
  mergeOfficeOutsideRecordsFromApi,
  OFFICE_OUTSIDE_FILE_TYPES,
  type OfficeOutsideFileType,
  type OfficeOutsideRecord,
} from "@/lib/office-outside-accounts"
import { api } from "@/lib/api"

const steps = [
  { id: 1, name: "Customer Details" },
  { id: 2, name: "Product Selection" },
  { id: 3, name: "Confirmation" },
]

type Props = {
  record?: OfficeOutsideRecord | null
  onCancel: () => void
  onSaved: () => void
}

export function OfficeOutsideQuotationForm({ record, onCancel, onSaved }: Props) {
  const initialCustomer = useMemo(() => customerFromOfficeOutsideRecord(record), [record])
  const [step, setStep] = useState(1)
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer || null)
  const [products, setProducts] = useState<ProductSelection | null>(record?.products || null)
  const [fileType, setFileType] = useState<OfficeOutsideFileType | "">(record?.fileType || "")

  const handleCustomerSubmit = (next: Customer) => {
    setCustomer(next)
    setStep(2)
  }

  const handleProductSubmit = (next: ProductSelection) => {
    setProducts(next)
    setStep(3)
  }

  const saveOutside = async (payload: {
    discount: number
    subtotal: number
    totalAmount: number
  }) => {
    if (!customer || !products) {
      throw new Error("Complete customer and product selection first")
    }
    const snapshot = snapshotFromOfficeOutsideForm({
      customer,
      products: { ...products, systemPrice: payload.subtotal },
      discount: payload.discount,
      subtotal: payload.subtotal,
      totalAmount: payload.totalAmount,
      fileType: fileType || undefined,
    })
    const row = record?.id
      ? updateOfficeOutsideRecord(record.id, snapshot)
      : createOfficeOutsideRecord(snapshot)
    try {
      const res = record?.id
        ? await api.admin.officeOutside.update(row.id, officeOutsideRecordToApiBody(row))
        : await api.admin.officeOutside.create(officeOutsideRecordToApiBody(row))
      const remote = pickOfficeOutsideRecordFromApi(res)
      if (remote) mergeOfficeOutsideRecordsFromApi([remote])
    } catch {
      // local row already saved
    }
    return { id: row.id }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-violet-950">
            {record?.id ? "Edit Office Outside" : "Create Office Outside"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Same quotation form as All quotations — this save stays in All Outside only.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="flex items-center justify-center overflow-x-auto pb-1">
        <div className="flex items-center min-w-fit">
          {steps.map((item, index) => (
            <div key={item.id} className="flex items-center">
              <div className="flex flex-col items-center min-w-[60px] sm:min-w-[90px] md:min-w-[110px]">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                    step > item.id
                      ? "bg-emerald-100 text-emerald-700"
                      : step === item.id
                        ? "bg-violet-100 text-violet-800 ring-1 ring-violet-200"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > item.id ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : item.id}
                </div>
                <span
                  className={`text-[10px] sm:text-xs mt-1.5 text-center px-0.5 leading-tight ${
                    step >= item.id ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  <span className="hidden sm:inline">{item.name}</span>
                  <span className="sm:hidden">
                    {item.name === "Customer Details"
                      ? "Customer"
                      : item.name === "Product Selection"
                        ? "Products"
                        : item.name}
                  </span>
                </span>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={`w-8 sm:w-12 md:w-20 h-0.5 mx-1 sm:mx-2 mb-5 sm:mb-6 ${
                    step > item.id ? "bg-emerald-200" : "bg-muted"
                  }`}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {step === 1 ? (
        <CustomerDetailsForm
          key={record?.id || "create-customer"}
          onSubmit={handleCustomerSubmit}
          initialData={customer || undefined}
        />
      ) : null}

      {step === 2 ? (
        <ProductSelectionForm
          key={record?.id ? `edit-products-${record.id}` : "create-products"}
          onSubmit={handleProductSubmit}
          onBack={() => setStep(1)}
          initialData={products || undefined}
        />
      ) : null}

      {step === 3 ? (
        customer && products ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 max-w-sm">
              <Label className="text-xs">File type</Label>
              <Select value={fileType || undefined} onValueChange={(value) => setFileType(value as OfficeOutsideFileType)}>
                <SelectTrigger className="h-9 mt-1 bg-white">
                  <SelectValue placeholder="Loan / Cash / Cash + loan" />
                </SelectTrigger>
                <SelectContent>
                  {OFFICE_OUTSIDE_FILE_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <QuotationConfirmation
            customer={customer}
            products={products}
            onBack={() => setStep(2)}
            onEditCustomer={() => setStep(1)}
            onEditProducts={() => setStep(2)}
            onSaveOverride={saveOutside}
            hideBrandedProposal
            initialDiscount={record?.discount}
            confirmLabel={record?.id ? "Save Office Outside" : "Confirm & Save to All Outside"}
            reviewTitle="Review Office Outside before saving"
            reviewBody="This is the same quotation form. Confirming saves here in All Outside only — it will not appear in All quotations. Pick an outside vendor afterwards, then open Slip for the 1-page quotation (customer + dealer + required products, no company name)."
            successTitle="Office Outside saved"
            successBody="This record is in All Outside only. Pick an outside vendor, then open Slip for the 1-page quotation."
            doneLabel="Back to All Outside"
            onDone={() => onSaved()}
          />
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10 text-muted-foreground">
                <p className="mb-4">Complete customer and product selection first.</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Customer Details
                  </Button>
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Product Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  )
}

