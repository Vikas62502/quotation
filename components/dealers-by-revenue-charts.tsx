"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BarChart3, IndianRupee, PieChart as PieChartIcon, Users, Zap } from "lucide-react"
import type { Dealer } from "@/lib/auth-context"
import { formatOverviewKw } from "@/lib/quotation-system-kw"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export type DealerRevenueStat = {
  dealer: Dealer
  quotationCount: number
  revenue: number
  totalKw: number
}

export type ChartMetric = "capacity" | "revenue" | "quotations"

type DealersByRevenueChartsProps = {
  stats: DealerRevenueStat[]
  metric?: ChartMetric
  onMetricChange?: (metric: ChartMetric) => void
}

export function compareDealerStatsByMetric(
  a: DealerRevenueStat,
  b: DealerRevenueStat,
  metric: ChartMetric,
): number {
  if (metric === "capacity") return b.totalKw - a.totalKw || b.revenue - a.revenue
  if (metric === "quotations") return b.quotationCount - a.quotationCount || b.revenue - a.revenue
  return b.revenue - a.revenue || b.quotationCount - a.quotationCount
}
type ChartShape = "bar" | "pie"

type ChartRow = {
  name: string
  value: number
  barLabel: string
  rank: number
  isMax: boolean
  color: string
  rawRevenue: number
  rawCapacity: number
  rawQuotations: number
}

const MAX_CHART_DEALERS = 10

/** Least (left) → most (right). Last stop is always light neon green for the maximum. */
const NEON_RAMP = ["#22d3ee", "#38bdf8", "#818cf8", "#c084fc", "#e879f9", "#fb7185", "#fb923c", "#facc15", "#a3e635"]
const NEON_MAX = "#86efac"
const NEON_MAX_DEEP = "#4ade80"

const revenueChartConfig = {
  value: { label: "Revenue", color: NEON_MAX_DEEP },
} satisfies ChartConfig

const capacityChartConfig = {
  value: { label: "kW", color: NEON_MAX_DEEP },
} satisfies ChartConfig

const quotationsChartConfig = {
  value: { label: "Quotations", color: NEON_MAX_DEEP },
} satisfies ChartConfig

function neonColorAt(index: number, total: number) {
  if (total <= 1 || index === total - 1) return NEON_MAX
  const t = index / Math.max(1, total - 2)
  const i = Math.round(t * (NEON_RAMP.length - 1))
  return NEON_RAMP[Math.max(0, Math.min(NEON_RAMP.length - 1, i))]
}

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.replace("#", "").trim()
  if (raw.length === 3) {
    return [parseInt(raw[0] + raw[0], 16), parseInt(raw[1] + raw[1], 16), parseInt(raw[2] + raw[2], 16)]
  }
  if (raw.length === 6) {
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)]
  }
  return null
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`
}

function mixToward(hex: string, target: [number, number, number], amount: number) {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return toHex(
    rgb[0] + (target[0] - rgb[0]) * amount,
    rgb[1] + (target[1] - rgb[1]) * amount,
    rgb[2] + (target[2] - rgb[2]) * amount,
  )
}

function lightenHex(hex: string, amount = 0.32) {
  return mixToward(hex, [255, 255, 255], amount)
}

function darkenHex(hex: string, amount = 0.28) {
  return mixToward(hex, [15, 23, 42], amount)
}

function ellipsePoint(cx: number, cy: number, rx: number, ry: number, angle: number) {
  return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) }
}

function donutSlicePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  inner: number,
  start: number,
  end: number,
) {
  const irx = rx * inner
  const iry = ry * inner
  const large = Math.abs(end - start) > Math.PI ? 1 : 0
  const p1 = ellipsePoint(cx, cy, rx, ry, start)
  const p2 = ellipsePoint(cx, cy, rx, ry, end)
  const p3 = ellipsePoint(cx, cy, irx, iry, end)
  const p4 = ellipsePoint(cx, cy, irx, iry, start)
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rx} ${ry} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${irx} ${iry} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ")
}

function frontWallPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth: number,
  start: number,
  end: number,
) {
  const steps = Math.max(6, Math.ceil((Math.abs(end - start) / 0.1) * 2))
  const top: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= steps; i += 1) {
    const angle = start + ((end - start) * i) / steps
    if (Math.sin(angle) < -0.02) continue
    top.push(ellipsePoint(cx, cy, rx, ry, angle))
  }
  if (top.length < 2) return null
  const bottom = top.map((point) => ({ x: point.x, y: point.y + depth }))
  const points = [...top, ...bottom.reverse()]
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`
}

function Bar3DShape(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  payload?: ChartRow
}) {
  const x = Number(props.x) || 0
  const y = Number(props.y) || 0
  const width = Number(props.width) || 0
  const height = Number(props.height) || 0
  if (width <= 0 || height <= 0) return null

  const row = props.payload
  const base = row?.isMax ? NEON_MAX_DEEP : row?.color || String(props.fill || NEON_MAX)
  const front = row?.isMax ? NEON_MAX : base
  const top = row?.isMax ? "#d1fae5" : lightenHex(base, 0.38)
  const side = row?.isMax ? "#22c55e" : darkenHex(base, 0.28)
  const depth = Math.min(14, Math.max(7, width * 0.28), Math.max(6, height * 0.35))
  const frontWidth = Math.max(4, width - depth)
  const frontHeight = Math.max(2, height - depth * 0.35)

  return (
    <g>
      <ellipse
        cx={x + frontWidth / 2 + depth * 0.15}
        cy={y + frontHeight + depth * 0.55}
        rx={frontWidth * 0.48}
        ry={5.5}
        fill={darkenHex(front, 0.45)}
        opacity={0.18}
      />
      <polygon
        points={`${x + frontWidth},${y + depth * 0.35} ${x + width},${y} ${x + width},${y + frontHeight - depth * 0.2} ${x + frontWidth},${y + frontHeight + depth * 0.15}`}
        fill={side}
      />
      <rect x={x} y={y + depth * 0.35} width={frontWidth} height={frontHeight} rx={5} fill={front} />
      <polygon
        points={`${x},${y + depth * 0.35} ${x + depth},${y} ${x + width},${y} ${x + frontWidth},${y + depth * 0.35}`}
        fill={top}
      />
      <line
        x1={x + 4}
        y1={y + depth * 0.35 + 3}
        x2={x + frontWidth - 4}
        y2={y + depth * 0.35 + 3}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.2}
      />
    </g>
  )
}

function formatRevenueInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`
}

function formatCompactRevenue(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1)}Cr`
  if (amount >= 1_00_000) return `₹${Math.round(amount / 1_00_000)}L`
  return `₹${Math.round(amount).toLocaleString("en-IN")}`
}

function dealerLabel(dealer: Dealer): string {
  const name = `${dealer.firstName} ${dealer.lastName}`.trim()
  return name || dealer.username
}

function TwoLineDealerTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const name = String(payload?.value || "").trim()
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0] || name
  const last = parts.slice(1).join(" ")
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle">
        <tspan x={0} dy={12} fontSize={11} fontWeight={600} fill="#334155">
          {first.length > 12 ? `${first.slice(0, 11)}…` : first}
        </tspan>
        {last ? (
          <tspan x={0} dy={14} fontSize={10} fill="#94a3b8">
            {last.length > 14 ? `${last.slice(0, 13)}…` : last}
          </tspan>
        ) : null}
      </text>
    </g>
  )
}

function DealerChartTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
  formatValue: (row: ChartRow) => string
}) {
  if (!active || !payload?.[0]?.payload) return null
  const row = payload[0].payload
  return (
    <div
      className={cn(
        "min-w-[11.5rem] rounded-2xl border bg-white/95 px-3.5 py-3 shadow-xl",
        row.isMax ? "border-emerald-200 shadow-emerald-500/15" : "border-cyan-200/80 shadow-cyan-950/10",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          row.isMax ? "text-emerald-600" : "text-cyan-600",
        )}
      >
        {row.isMax ? "Maximum" : `#${row.rank}`}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-800">{row.name}</p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          row.isMax ? "text-emerald-600" : "text-slate-800",
        )}
      >
        {formatValue(row)}
      </p>
      <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
        <p>{formatOverviewKw(row.rawCapacity)}</p>
        <p>{formatRevenueInr(row.rawRevenue)}</p>
        <p>
          {row.rawQuotations} unique customer{row.rawQuotations === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  )
}

function DealerBarChart({
  data,
  config,
  formatValue,
  formatTick,
}: {
  data: ChartRow[]
  config: ChartConfig
  formatValue: (row: ChartRow) => string
  formatTick: (value: number) => string
}) {
  const isMobile = useIsMobile()

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto w-full", isMobile ? "h-[18rem]" : "h-[24rem]")}
    >
      <BarChart
        data={data}
        margin={{ left: 4, right: isMobile ? 8 : 18, top: 32, bottom: isMobile ? 0 : 8 }}
        barCategoryGap={isMobile ? "12%" : "18%"}
      >
        <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="4 10" strokeOpacity={0.45} />
        <XAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          interval={0}
          height={isMobile ? 0 : 52}
          tick={isMobile ? false : <TwoLineDealerTick />}
        />
        <YAxis
          type="number"
          tickLine={false}
          axisLine={false}
          width={isMobile ? 36 : 48}
          tick={{ fontSize: isMobile ? 10 : 11, fill: "#94a3b8" }}
          tickFormatter={(value) => formatTick(Number(value) || 0)}
        />
        <Tooltip
          cursor={{ fill: "rgba(134, 239, 172, 0.12)" }}
          content={<DealerChartTooltip formatValue={formatValue} />}
          wrapperStyle={{ outline: "none" }}
        />
        <Bar dataKey="value" maxBarSize={isMobile ? 36 : 52} shape={(props) => <Bar3DShape {...props} />}>
          {data.map((row) => (
            <Cell
              key={`${row.rank}-${row.name}`}
              fill={row.color}
            />
          ))}
          <LabelList
            dataKey="barLabel"
            position="top"
            offset={isMobile ? 8 : 12}
            style={{ fill: "#0f172a", fontSize: isMobile ? 10 : 11, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function DealerPieChart({
  data,
  formatValue,
  centerTitle,
  centerValue,
}: {
  data: ChartRow[]
  formatValue: (row: ChartRow) => string
  centerTitle: string
  centerValue: string
}) {
  const [hover, setHover] = useState<ChartRow | null>(null)
  const total = data.reduce((sum, row) => sum + row.value, 0)
  const cx = 200
  const cy = 128
  const rx = 148
  const ry = 78
  const depth = 22
  const inner = 0.58
  const gap = 0.035

  const slices = useMemo(() => {
    if (total <= 0) return []
    let angle = -Math.PI / 2
    return data.map((row) => {
      const sweep = Math.max(0, (row.value / total) * Math.PI * 2 - gap)
      const start = angle + gap / 2
      const end = start + sweep
      angle += (row.value / total) * Math.PI * 2
      return { ...row, start, end }
    })
  }, [data, total])

  return (
    <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_15.5rem]">
      <div className="relative mx-auto h-[24rem] w-full max-w-[34rem]">
        <svg viewBox="0 0 400 280" className="h-full w-full" role="img">
          <ellipse cx={cx} cy={cy + depth + 10} rx={rx * 0.92} ry={18} fill="#0f172a" opacity={0.08} />
          {slices.map((row) => {
            const wall = frontWallPath(cx, cy, rx, ry, depth, row.start, row.end)
            const innerWall = frontWallPath(cx, cy, rx * inner, ry * inner, depth, row.start, row.end)
            return (
              <g key={`wall-${row.rank}-${row.name}`}>
                {wall ? <path d={wall} fill={darkenHex(row.color, 0.32)} /> : null}
                {innerWall ? <path d={innerWall} fill={darkenHex(row.color, 0.22)} /> : null}
              </g>
            )
          })}
          {slices.map((row) => (
            <path
              key={`top-${row.rank}-${row.name}`}
              d={donutSlicePath(cx, cy, rx, ry, inner, row.start, row.end)}
              fill={hover?.rank === row.rank ? lightenHex(row.color, 0.18) : row.color}
              stroke={row.isMax ? NEON_MAX_DEEP : "rgba(255,255,255,0.85)"}
              strokeWidth={row.isMax ? 2.4 : 1.4}
              className="cursor-pointer"
              onMouseEnter={() => setHover(row)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          <text x={cx} y={cy - 4} textAnchor="middle">
            <tspan x={cx} y={cy - 16} fill="#64748b" fontSize={10} fontWeight={700}>
              MAXIMUM
            </tspan>
            <tspan x={cx} y={cy + 4} fill="#065f46" fontSize={12} fontWeight={600}>
              {centerTitle.length > 18 ? `${centerTitle.slice(0, 17)}…` : centerTitle}
            </tspan>
            <tspan x={cx} y={cy + 24} fill="#16a34a" fontSize={16} fontWeight={800}>
              {centerValue}
            </tspan>
          </text>
        </svg>
        {hover ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <DealerChartTooltip active payload={[{ payload: hover }]} formatValue={formatValue} />
          </div>
        ) : null}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
        {data.map((row) => {
          const share = total > 0 ? Math.round((row.value / total) * 100) : 0
          return (
            <li
              key={`${row.rank}-${row.name}`}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-1.5",
                row.isMax ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-white/60",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ backgroundColor: row.color, color: row.color }}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{row.name}</span>
              <span className={cn("shrink-0 text-xs font-bold tabular-nums", row.isMax ? "text-emerald-600" : "text-slate-500")}>
                {row.barLabel}
                <span className="ml-1 font-medium text-slate-400">{share}%</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MetricTab({
  value,
  icon: Icon,
  label,
}: {
  value: ChartMetric
  icon: typeof Zap
  label: string
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "gap-1.5 rounded-full text-xs sm:text-sm",
        "data-[state=active]:bg-emerald-400 data-[state=active]:text-emerald-950 data-[state=active]:shadow-md data-[state=active]:shadow-emerald-400/40",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </TabsTrigger>
  )
}

function ShapeSwitch({
  value,
  onChange,
}: {
  value: ChartShape
  onChange: (next: ChartShape) => void
}) {
  return (
    <div className="inline-flex h-10 items-center rounded-full border border-emerald-100 bg-white/90 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange("bar")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all sm:text-sm",
          value === "bar"
            ? "bg-cyan-400 text-cyan-950 shadow-md shadow-cyan-400/30"
            : "text-slate-500 hover:text-slate-800",
        )}
      >
        <BarChart3 className="size-3.5" />
        Bars
      </button>
      <button
        type="button"
        onClick={() => onChange("pie")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all sm:text-sm",
          value === "pie"
            ? "bg-emerald-400 text-emerald-950 shadow-md shadow-emerald-400/40"
            : "text-slate-500 hover:text-slate-800",
        )}
      >
        <PieChartIcon className="size-3.5" />
        Pie
      </button>
    </div>
  )
}

export function DealersByRevenueCharts({
  stats,
  metric: controlledMetric,
  onMetricChange,
}: DealersByRevenueChartsProps) {
  const [localMetric, setLocalMetric] = useState<ChartMetric>("capacity")
  const metric = controlledMetric ?? localMetric
  const setMetric = (next: ChartMetric) => {
    setLocalMetric(next)
    onMetricChange?.(next)
  }
  const [shape, setShape] = useState<ChartShape>("bar")

  const chartData = useMemo(() => {
    const sortedDesc = [...stats].sort((a, b) => compareDealerStatsByMetric(a, b, metric))
    const top = sortedDesc.slice(0, MAX_CHART_DEALERS)
    const ascending = [...top].reverse()

    return ascending.map((stat, index) => {
      const value =
        metric === "revenue" ? stat.revenue : metric === "capacity" ? stat.totalKw : stat.quotationCount
      const barLabel =
        metric === "revenue"
          ? formatCompactRevenue(stat.revenue)
          : metric === "capacity"
            ? stat.totalKw >= 1000
              ? `${(stat.totalKw / 1000).toFixed(1)}MW`
              : stat.totalKw.toFixed(1)
            : String(stat.quotationCount)
      const isMax = index === ascending.length - 1
      return {
        name: dealerLabel(stat.dealer),
        rank: ascending.length - index,
        isMax,
        color: neonColorAt(index, ascending.length),
        rawRevenue: stat.revenue,
        rawCapacity: stat.totalKw,
        rawQuotations: stat.quotationCount,
        value,
        barLabel,
      }
    })
  }, [stats, metric])

  if (chartData.length === 0) {
    return null
  }

  const leader = chartData[chartData.length - 1]
  const rankingLabel =
    metric === "capacity" ? "kW" : metric === "quotations" ? "quotations" : "revenue"
  const formatLeader =
    metric === "capacity"
      ? formatOverviewKw(leader.rawCapacity)
      : metric === "quotations"
        ? String(leader.rawQuotations)
        : formatCompactRevenue(leader.rawRevenue)
  const formatValue =
    metric === "capacity"
      ? (row: ChartRow) => formatOverviewKw(row.rawCapacity)
      : metric === "quotations"
        ? (row: ChartRow) => `${row.rawQuotations} unique customer${row.rawQuotations === 1 ? "" : "s"}`
        : (row: ChartRow) => formatRevenueInr(row.rawRevenue)
  const formatTick =
    metric === "capacity"
      ? (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}MW` : `${value.toFixed(0)}`)
      : metric === "quotations"
        ? (value: number) => String(Math.round(value))
        : formatCompactRevenue
  const config =
    metric === "capacity" ? capacityChartConfig : metric === "quotations" ? quotationsChartConfig : revenueChartConfig

  return (
    <div className="space-y-3">
      <Tabs value={metric} onValueChange={(value) => setMetric(value as ChartMetric)}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <TabsList className="h-10 w-full max-w-md rounded-full bg-cyan-50/80 p-1">
            <MetricTab value="capacity" icon={Zap} label="kW" />
            <MetricTab value="revenue" icon={IndianRupee} label="Revenue" />
            <MetricTab value="quotations" icon={Users} label="Quotations" />
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <ShapeSwitch value={shape} onChange={setShape} />
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 px-3 py-1.5 shadow-sm">
              <span className="rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-950">
                Max
              </span>
              <span className="text-sm font-semibold text-slate-800">{leader.name}</span>
              <span className="text-sm font-bold tabular-nums text-emerald-600">{formatLeader}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-100 bg-gradient-to-b from-cyan-50/50 via-white to-emerald-50/40 p-2 shadow-inner sm:p-3">
          <TabsContent value={metric} className="mt-0">
            {shape === "pie" ? (
              <DealerPieChart
                data={chartData}
                formatValue={formatValue}
                centerTitle={leader.name}
                centerValue={formatLeader}
              />
            ) : (
              <DealerBarChart data={chartData} config={config} formatValue={formatValue} formatTick={formatTick} />
            )}
          </TabsContent>
        </div>
      </Tabs>

      {stats.length > MAX_CHART_DEALERS ? (
        <p className="text-xs text-muted-foreground">
          Showing top {MAX_CHART_DEALERS} dealers by {rankingLabel}, lowest on the left and maximum in light green.
        </p>
      ) : null}
    </div>
  )
}
