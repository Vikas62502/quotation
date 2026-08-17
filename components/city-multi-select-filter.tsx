"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SERVICE_CITIES } from "@/lib/service-cities"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, MapPin, X } from "lucide-react"

type Props = {
  value: string[]
  onChange: (cities: string[]) => void
  cities?: readonly string[]
  placeholder?: string
  className?: string
  /** Compact trigger for dense filter bars */
  size?: "default" | "sm"
}

export function CityMultiSelectFilter({
  value,
  onChange,
  cities = SERVICE_CITIES,
  placeholder = "All cities",
  className,
  size = "default",
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = useMemo(() => new Set(value.map((c) => c.trim()).filter(Boolean)), [value])

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...cities]
    return cities.filter((c) => c.toLowerCase().includes(q))
  }, [cities, query])

  const label =
    selected.size === 0
      ? placeholder
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} cities`

  const toggle = (city: string) => {
    const next = new Set(selected)
    if (next.has(city)) next.delete(city)
    else next.add(city)
    onChange([...next].sort((a, b) => a.localeCompare(b)))
  }

  const clear = () => onChange([])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "justify-between font-normal",
            size === "sm" ? "h-9" : "h-10",
            selected.size > 0 ? "text-foreground" : "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2 min-w-0 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(100vw-2rem,20rem)] p-0">
        <div className="p-2 border-b space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cities..."
            className="h-8"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {selected.size === 0 ? "Multi-select cities" : `${selected.size} selected`}
            </p>
            {selected.size > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clear}>
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredCities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No cities found</p>
          ) : (
            filteredCities.map((city) => {
              const checked = selected.has(city)
              return (
                <button
                  key={city}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted/60",
                    checked && "bg-muted/40",
                  )}
                  onClick={() => toggle(city)}
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span className="flex-1 truncate">{city}</span>
                  {checked ? <Check className="w-3.5 h-3.5 text-primary shrink-0" /> : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
