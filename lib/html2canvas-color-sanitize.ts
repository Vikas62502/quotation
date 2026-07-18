const UNSUPPORTED_COLOR_RE = /\b(lab|oklab|oklch|lch|color)\(/i

export function usesUnsupportedColor(value: string): boolean {
  return UNSUPPORTED_COLOR_RE.test(value)
}

function classColorFallback(el: HTMLElement, prop: string): string {
  const isBg = prop.includes("background")
  const isBorder = prop.includes("border") && !prop.includes("background")

  if (el.classList.contains("prop-bar") || (el.tagName === "TH" && el.closest(".prop-table"))) {
    return isBg || isBorder ? "#1a365d" : "#ffffff"
  }
  if (el.closest(".prop-total-row")) {
    return isBg ? "#edf2f7" : "#1a365d"
  }
  if (el.closest(".prop-highlight-row")) {
    return isBg ? "#fde68a" : "#1a202c"
  }
  if (el.classList.contains("prop-note-green")) {
    if (isBg) return "#f0fff4"
    if (isBorder) return "#48bb78"
    return "#22543d"
  }
  if (el.classList.contains("prop-subbar")) {
    if (isBg) return "#fef3c7"
    if (isBorder) return "#f6ad55"
    return "#1a202c"
  }
  if (el.classList.contains("icici")) return isBg ? "#ebf8ff" : "#1a202c"
  if (el.classList.contains("sbi")) return isBg ? "#f0fff4" : "#1a202c"
  if (el.tagName === "H1" && el.closest(".prop-title-block")) {
    return prop === "color" ? "#1a365d" : isBg ? "#ffffff" : "#cbd5e0"
  }
  if (el.classList.contains("prop-tagline")) {
    return prop === "color" ? "#c05621" : isBg ? "#ed8936" : "#cbd5e0"
  }
  if (el.classList.contains("prop-field-label")) {
    return isBg ? "#edf2f7" : "#1a365d"
  }
  if (el.classList.contains("prop-field-value")) {
    return isBg ? "#ffffff" : "#2d3748"
  }
  if (el.classList.contains("prop-component-cell")) {
    return prop === "color" ? "#1a365d" : isBg ? "#ffffff" : "#cbd5e0"
  }
  if (el.closest(".prop-table tr:nth-child(even)") || el.closest("tr:nth-child(even)")) {
    if (isBg) return "#f7fafc"
  }
  if (el.closest(".prop-offices")) {
    return prop === "color" ? "#4a5568" : isBg ? "#ffffff" : "#cbd5e0"
  }

  if (isBg) return "#ffffff"
  if (isBorder) return "#cbd5e0"
  return "#1a202c"
}

const COLOR_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
] as const

/** Inline safe colors so html2canvas never parses lab()/oklch() from global CSS. */
export function sanitizeColorsForHtml2Canvas(root: HTMLElement, view: Window = window): void {
  const nodes: HTMLElement[] = [root]
  root.querySelectorAll("*").forEach((el) => {
    if (el instanceof HTMLElement) nodes.push(el)
  })

  for (const el of nodes) {
    const computed = view.getComputedStyle(el)
    for (const prop of COLOR_PROPS) {
      const value = computed.getPropertyValue(prop)
      if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") continue

      const safe = usesUnsupportedColor(value) ? classColorFallback(el, prop) : value
      // Always inline so html2canvas does not read lab()/oklch() from global stylesheets.
      el.style.setProperty(prop, safe, "important")
    }
  }
}
