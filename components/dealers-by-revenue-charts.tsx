"use client"

import { useId, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Pie,
  PieChart,
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

export type DealerRevenueStat = {
  dealer: Dealer
  quotationCount: number
  revenue: number
  totalKw: number
}

type DealersByRevenueChartsProps = {
  stats: DealerRevenueStat[]
}

type ChartMetric = "capacity" | "revenue" | "quotations"
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
  const reactId = useId().replace(/:/g, "")
  const maxGradId = `dealer-neon-max-${reactId}`
  const glowId = `dealer-neon-glow-${reactId}`

  return (
    <ChartContainer config={config} className="aspect-auto h-[24rem] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 28, bottom: 4 }} barCategoryGap="22%">
        <defs>
          <linearGradient id={maxGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d1fae5" />
            <stop offset="45%" stopColor={NEON_MAX} />
            <stop offset="100%" stopColor={NEON_MAX_DEEP} />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor={NEON_MAX_DEEP} floodOpacity="0.35" />
          </filter>
        </defs>
        <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="4 10" strokeOpacity={0.45} />
        <XAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          interval={0}
          height={52}
          tick={<TwoLineDealerTick />}
        />
        <YAxis
          type="number"
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(value) => formatTick(Number(value) || 0)}
        />
        <Tooltip
          cursor={{ fill: "rgba(134, 239, 172, 0.12)" }}
          content={<DealerChartTooltip formatValue={formatValue} />}
          wrapperStyle={{ outline: "none" }}
        />
        <Bar dataKey="value" radius={[14, 14, 6, 6]} maxBarSize={48}>
          {data.map((row) => (
            <Cell
              key={`${row.rank}-${row.name}`}
              fill={row.isMax ? `url(#${maxGradId})` : row.color}
              stroke={row.isMax ? NEON_MAX_DEEP : "transparent"}
              strokeWidth={row.isMax ? 1.5 : 0}
              filter={row.isMax ? `url(#${glowId})` : undefined}
            />
          ))}
          <LabelList
            dataKey="barLabel"
            position="top"
            offset={8}
            style={{ fill: "#0f172a", fontSize: 11, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function DealerPieChart({
  data,
  config,
  formatValue,
  centerTitle,
  centerValue,
}: {
  data: ChartRow[]
  config: ChartConfig
  formatValue: (row: ChartRow) => string
  centerTitle: string
  centerValue: string
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_15.5rem]">
      <ChartContainer config={config} className="aspect-auto h-[24rem] w-full">
        <PieChart>
          <Tooltip content={<DealerChartTooltip formatValue={formatValue} />} wrapperStyle={{ outline: "none" }} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={78}
            outerRadius={118}
            paddingAngle={3}
            stroke="#fff"
            strokeWidth={3}
            startAngle={90}
            endAngle={-270}
          >
            {data.map((row) => (
              <Cell
                key={`${row.rank}-${row.name}`}
                fill={row.color}
                stroke={row.isMax ? NEON_MAX_DEEP : "#fff"}
                strokeWidth={row.isMax ? 3 : 3}
              />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null
                const cx = Number(viewBox.cx) || 0
                const cy = Number(viewBox.cy) || 0
                return (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={cx} y={cy - 18} fill="#64748b" fontSize={10} fontWeight={700}>
                      MAXIMUM
                    </tspan>
                    <tspan x={cx} y={cy + 2} fill="#065f46" fontSize={12} fontWeight={600}>
                      {centerTitle.length > 18 ? `${centerTitle.slice(0, 17)}…` : centerTitle}
                    </tspan>
                    <tspan x={cx} y={cy + 22} fill="#16a34a" fontSize={16} fontWeight={800}>
                      {centerValue}
                    </tspan>
                  </text>
                )
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
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
              <span className="size-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: row.color, color: row.color }} />
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

export function DealersByRevenueCharts({ stats }: DealersByRevenueChartsProps) {
  const [metric, setMetric] = useState<ChartMetric>("capacity")
  const [shape, setShape] = useState<ChartShape>("bar")

  const chartData = useMemo(() => {
    const sortedDesc = [...stats].sort((a, b) => {
      if (metric === "capacity") return b.totalKw - a.totalKw || b.revenue - a.revenue
      if (metric === "quotations") return b.quotationCount - a.quotationCount || b.revenue - a.revenue
      return b.revenue - a.revenue || b.quotationCount - a.quotationCount
    })
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
                config={config}
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
