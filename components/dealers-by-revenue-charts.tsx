"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import type { Dealer } from "@/lib/auth-context"
import { formatOverviewKw } from "@/lib/quotation-system-kw"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type DealerRevenueStat = {
  dealer: Dealer
  quotationCount: number
  revenue: number
  totalKw: number
}

type DealersByRevenueChartsProps = {
  stats: DealerRevenueStat[]
}

type ChartMetric = "revenue" | "capacity" | "quotations"

const MAX_CHART_DEALERS = 10

const revenueChartConfig = {
  value: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

const capacityChartConfig = {
  value: { label: "Capacity", color: "var(--chart-2)" },
} satisfies ChartConfig

const quotationsChartConfig = {
  value: { label: "Quotations", color: "var(--chart-3)" },
} satisfies ChartConfig

function formatRevenueLakh(amount: number): string {
  return `₹${(amount / 100000).toFixed(1)}L`
}

function dealerLabel(dealer: Dealer): string {
  const name = `${dealer.firstName} ${dealer.lastName}`.trim()
  return name || dealer.username
}

function DealerMetricChart({
  data,
  dataKey,
  config,
  formatValue,
}: {
  data: Array<{ name: string; value: number; rawRevenue: number; rawCapacity: number; rawQuotations: number }>
  dataKey: "value"
  config: ChartConfig
  formatValue: (row: (typeof data)[number]) => string
}) {
  const chartHeight = Math.max(220, data.length * 44)

  return (
    <ChartContainer config={config} className="w-full aspect-auto" style={{ height: chartHeight }}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
        barCategoryGap="20%"
      >
        <YAxis
          type="category"
          dataKey="name"
          width={132}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_, __, item) => (
                <span className="font-medium">{formatValue(item.payload as (typeof data)[number])}</span>
              )}
            />
          }
        />
        <Bar dataKey={dataKey} fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  )
}

export function DealersByRevenueCharts({ stats }: DealersByRevenueChartsProps) {
  const [metric, setMetric] = useState<ChartMetric>("revenue")

  const chartData = useMemo(() => {
    const sorted = [...stats].sort(
      (a, b) => b.revenue - a.revenue || b.quotationCount - a.quotationCount,
    )

    return sorted.slice(0, MAX_CHART_DEALERS).map((stat) => ({
      name: dealerLabel(stat.dealer),
      rawRevenue: stat.revenue,
      rawCapacity: stat.totalKw,
      rawQuotations: stat.quotationCount,
      value:
        metric === "revenue"
          ? stat.revenue / 100000
          : metric === "capacity"
            ? stat.totalKw
            : stat.quotationCount,
    }))
  }, [stats, metric])

  if (chartData.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <Tabs value={metric} onValueChange={(value) => setMetric(value as ChartMetric)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="capacity">Capacity (kW)</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <DealerMetricChart
            data={chartData}
            dataKey="value"
            config={revenueChartConfig}
            formatValue={(row) => formatRevenueLakh(row.rawRevenue)}
          />
        </TabsContent>

        <TabsContent value="capacity" className="mt-4">
          <DealerMetricChart
            data={chartData}
            dataKey="value"
            config={capacityChartConfig}
            formatValue={(row) => formatOverviewKw(row.rawCapacity)}
          />
        </TabsContent>

        <TabsContent value="quotations" className="mt-4">
          <DealerMetricChart
            data={chartData}
            dataKey="value"
            config={quotationsChartConfig}
            formatValue={(row) =>
              `${row.rawQuotations} approved quotation${row.rawQuotations === 1 ? "" : "s"}`
            }
          />
        </TabsContent>
      </Tabs>

      {stats.length > MAX_CHART_DEALERS ? (
        <p className="text-xs text-muted-foreground">
          Showing top {MAX_CHART_DEALERS} dealers by revenue. See the breakdown list below for all dealers.
        </p>
      ) : null}
    </div>
  )
}
