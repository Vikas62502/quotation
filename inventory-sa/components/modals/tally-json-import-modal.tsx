// @ts-nocheck
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Loader2, AlertCircle, Upload, FileJson, CheckCircle2, AlertTriangle } from "lucide-react"
import { productsApi, type Product } from "@/inventory-sa/lib/api"
import {
  buildPrefillFromTallyLines,
  parseTallySaleJson,
  type TallyImportLineItem,
  type TallyImportPrefill,
} from "@/inventory-sa/lib/tally-json-import"
import { formatSaleQuantity } from "@/inventory-sa/lib/utils"

interface TallyJsonImportModalProps {
  onClose: () => void
  onContinue: (prefill: TallyImportPrefill, saleType: "b2b" | "b2c") => void
  availableProductIds?: Set<string>
  forcedSaleType?: "b2b" | "b2c"
}

export default function TallyJsonImportModal({
  onClose,
  onContinue,
  availableProductIds,
  forcedSaleType,
}: TallyJsonImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saleType, setSaleType] = useState<"b2b" | "b2c">(forcedSaleType || "b2c")
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [lines, setLines] = useState<TallyImportLineItem[]>([])
  const [header, setHeader] = useState<Omit<TallyImportPrefill, "items"> | null>(null)
  const [detectedType, setDetectedType] = useState<"b2b" | "b2c" | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingProducts(true)
        const data = await productsApi.getAll()
        setProducts(data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load products")
      } finally {
        setLoadingProducts(false)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (forcedSaleType) setSaleType(forcedSaleType)
  }, [forcedSaleType])

  const selectableProducts = useMemo(() => {
    if (!availableProductIds?.size) return products
    return products.filter((p) => availableProductIds.has(p.id))
  }, [products, availableProductIds])

  const unmatchedCount = lines.filter((l) => !l.productId).length
  const readyCount = lines.filter((l) => l.productId && l.quantity > 0).length

  const handleParsePayload = (payload: unknown, sourceName: string) => {
    setError(null)
    try {
      const parsed = parseTallySaleJson(payload, products, saleType)
      setLines(parsed.lines)
      setHeader(parsed.prefill)
      setDetectedType(parsed.saleType)
      setSaleType(parsed.saleType)
      setFileName(sourceName)
    } catch (err: unknown) {
      setLines([])
      setHeader(null)
      setDetectedType(null)
      setError(err instanceof Error ? err.message : "Failed to parse Tally JSON")
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      handleParsePayload(payload, file.name)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid JSON file")
    }
    e.target.value = ""
  }

  const updateLineProduct = (index: number, productId: string) => {
    setLines((prev) => {
      const next = [...prev]
      const product = products.find((p) => p.id === productId)
      next[index] = {
        ...next[index],
        productId: productId || null,
        matchedProductName: product?.name || null,
        matchConfidence: productId ? "exact" : "none",
      }
      return next
    })
  }

  const handleContinue = () => {
    if (!header) return
    if (unmatchedCount > 0) {
      setError("Map all Tally items to inventory products before continuing.")
      return
    }
    if (readyCount === 0) {
      setError("At least one line item with quantity is required.")
      return
    }
    onContinue(buildPrefillFromTallyLines(header, lines), saleType)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <Card className="bg-background border-border w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Import Tally JSON</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-muted-foreground">
            Upload a Tally export JSON (<code className="text-foreground">tallymessage</code>) to prefill a{" "}
            {saleType.toUpperCase()} sale. Unmatched products can be mapped manually before opening the sale form.
          </p>

          {!forcedSaleType ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSaleType("b2b")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  saleType === "b2b"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                B2B
              </button>
              <button
                type="button"
                onClick={() => setSaleType("b2c")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  saleType === "b2c"
                    ? "bg-sky-600 text-white"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                B2C
              </button>
            </div>
          ) : (
            <div className="inline-flex rounded-md bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary">
              {saleType.toUpperCase()} JSON import
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              className="border-border text-foreground"
              disabled={loadingProducts}
              onClick={() => fileInputRef.current?.click()}
            >
              {loadingProducts ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload JSON file
            </Button>
            {fileName && <span className="text-xs text-muted-foreground self-center truncate">{fileName}</span>}
          </div>

          {detectedType && (
            <p className="text-xs text-muted-foreground">
              Detected sale type: <span className="text-foreground font-medium">{detectedType.toUpperCase()}</span>
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {header && (
            <div className="p-3 bg-muted/30 border border-border rounded-lg text-sm space-y-1">
              <p className="text-foreground font-medium">{header.customerName}</p>
              {header.customerPhone && <p className="text-muted-foreground">Phone: {header.customerPhone}</p>}
              {header.billingAddress.line1 && (
                <p className="text-muted-foreground">
                  {header.billingAddress.line1}
                  {header.billingAddress.state ? `, ${header.billingAddress.state}` : ""}
                  {header.billingAddress.postal_code ? ` - ${header.billingAddress.postal_code}` : ""}
                </p>
              )}
              {header.reference && <p className="text-muted-foreground text-xs">Ref: {header.reference}</p>}
            </div>
          )}

          {lines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">Line items</span>
                <span className="text-muted-foreground">
                  {readyCount} ready · {unmatchedCount} need mapping
                </span>
              </div>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Tally item</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Rate</th>
                      <th className="text-right p-2">GST%</th>
                      <th className="text-left p-2">Inventory product</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const isMatched = Boolean(line.productId)
                      return (
                        <tr key={`${line.tallyStockItemName}-${index}`} className="border-t border-border">
                          <td className="p-2 text-foreground">
                            <div>{line.tallyStockItemName}</div>
                            {line.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">{line.description}</div>
                            )}
                          </td>
                          <td className="p-2 text-right text-muted-foreground whitespace-nowrap">
                            {formatSaleQuantity(line.quantity)} {line.unit}
                          </td>
                          <td className="p-2 text-right text-muted-foreground">₹{line.unitPrice.toFixed(2)}</td>
                          <td className="p-2 text-right text-muted-foreground">{line.gstRate}%</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2 min-w-[220px]">
                              {isMatched ? (
                                <CheckCircle2
                                  className={`w-4 h-4 shrink-0 ${
                                    line.matchConfidence === "exact" ? "text-emerald-600" : "text-amber-600"
                                  }`}
                                />
                              ) : (
                                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                              )}
                              <select
                                value={line.productId || ""}
                                onChange={(e) => updateLineProduct(index, e.target.value)}
                                className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-foreground text-xs"
                              >
                                <option value="">Select product…</option>
                                {selectableProducts.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                    {product.model && product.model !== product.name ? ` - ${product.model}` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-2 justify-end">
          <Button type="button" variant="outline" className="border-border" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!header || loadingProducts}
            onClick={handleContinue}
          >
            Open {saleType.toUpperCase()} sale form
          </Button>
        </div>
      </Card>
    </div>
  )
}
