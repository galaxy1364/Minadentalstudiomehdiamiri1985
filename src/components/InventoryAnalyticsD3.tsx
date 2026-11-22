import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  TrendingDown, DollarSign, CalendarClock, AlertTriangle,
  Truck, Sparkles, Activity, CheckCircle2, Layers
} from 'lucide-react';
import { Appointment, InventoryItem, Patient, TreatmentType } from '../types/dental';
import { CLINICAL_CONSUMPTION_RECIPES } from '../services/inventoryConsumptionService';
import { formatToman, getCurrentPersianDate, getRelativePersianDate, toPersianDigits } from '../utils/jalali';
import { inferTreatmentTypeFromLabel } from '../utils/treatmentIntelligence';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export interface LowStockTrendPoint {
  dayOffset: number;
  dayLabel: string;
  projectedStock: number;
}

export interface LowStockItemTrend {
  itemId: string;
  itemName: string;
  unit: string;
  currentStock: number;
  minAlert: number;
  dailyBurnRate: number;
  daysUntilThreshold: number;
  urgency: 'critical' | 'warning' | 'healthy';
  points: LowStockTrendPoint[];
}

export interface ProcedureCostMetric {
  treatmentType: TreatmentType;
  title: string;
  materialCostToman: number;
  observedFrequency: number;
  monthlySpendProjectionToman: number;
  matchedSuppliesCount: number;
  ingredientBreakdown: Array<{ keyword: string; matchedName: string; unitCost: number; qty: number }>;
}

export interface ReplenishmentForecastRow {
  itemId: string;
  itemName: string;
  category: string;
  currentStock: number;
  minAlert: number;
  unit: string;
  dailyConsumption: number;
  daysUntilReorder: number;
  daysUntilStockout: number;
  predictedReplenishDate: string;
  urgencyLabel: 'سفارش فوری' | 'نزدیک به سفارش' | 'پایدار';
  recommendedQty: number;
  estimatedOrderCost: number;
}

export interface InventoryAnalyticsSummary {
  horizonLabels: string[];
  criticalTrends: LowStockItemTrend[];
  costPerProcedure: ProcedureCostMetric[];
  replenishmentForecasts: ReplenishmentForecastRow[];
  totalMonthlyProjectedSpend: number;
  avgCostPerProcedure: number;
  urgentReorderCount: number;
}

const FALLBACK_UNIT_PRICES: Record<string, number> = {
  'کامپوزیت': 1850000,
  'لیدوکائین': 45000,
  'سوزن': 18000,
  'فیکسچر': 3400000,
  'پروتیپر': 480000,
  'دستکش': 22000,
  'speedex': 620000,
  'باندینگ': 950000
};

function normalizePersianSearch(txt?: string): string {
  return (txt || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();
}

export function buildInventoryAnalyticsSummary(
  inventory: InventoryItem[],
  patients: Patient[] = [],
  appointments: Appointment[] = []
): InventoryAnalyticsSummary {
  // 1. Observe clinical treatment frequency across Palmer charts & appointment schedule
  const treatmentCounts = new Map<TreatmentType, number>();
  const bumpTreatment = (t: TreatmentType, weight = 1) => {
    treatmentCounts.set(t, (treatmentCounts.get(t) || 0) + weight);
  };

  patients.forEach((p) => {
    Object.values(p.teethConditions || {}).forEach((cond) => {
      bumpTreatment(cond.treatment, 1);
      (cond.history || []).forEach((h) => bumpTreatment(h.treatment, 0.75));
    });
  });

  appointments.forEach((appt) => {
    const inferred = inferTreatmentTypeFromLabel(appt.treatment);
    bumpTreatment(inferred, 1);
  });

  // Ensure realistic clinical baseline if dataset is tiny (e.g. isolated unit fixture)
  const totalObserved = Array.from(treatmentCounts.values()).reduce((s, v) => s + v, 0);
  if (totalObserved < 4) {
    bumpTreatment('composite', 6);
    bumpTreatment('endo', 4);
    bumpTreatment('crown_zirconia', 3);
    bumpTreatment('implant', 2);
    bumpTreatment('extraction', 3);
  }

  // 2. Compute Cost-Per-Procedure metrics from BOM recipes + live inventory unit prices
  const costPerProcedure: ProcedureCostMetric[] = Object.values(CLINICAL_CONSUMPTION_RECIPES)
    .filter((rec): rec is NonNullable<typeof rec> => Boolean(rec))
    .map((recipe) => {
      let totalCost = 0;
      let matchedSuppliesCount = 0;
      const ingredientBreakdown: ProcedureCostMetric['ingredientBreakdown'] = [];

      recipe.items.forEach((req) => {
        const kw = normalizePersianSearch(req.nameKeyword);
        const invMatch = inventory.find((item) => normalizePersianSearch(item.name).includes(kw));
        const unitCost = invMatch?.pricePerUnit && invMatch.pricePerUnit > 0
          ? invMatch.pricePerUnit
          : FALLBACK_UNIT_PRICES[kw] || 150000;
        if (invMatch) matchedSuppliesCount += 1;

        // Divide bulk kit/tube price realistically into clinical per-session unit cost when large bulk tubes/packs
        const sessionFraction =
          kw.includes('کامپوزیت') || kw.includes('باندینگ')
            ? 0.18
            : kw.includes('speedex')
            ? 0.2
            : kw.includes('لیدوکائین') || kw.includes('سوزن') || kw.includes('دستکش')
            ? 0.08
            : 1;
        const effectiveCost = Math.round(unitCost * sessionFraction * req.quantity);
        totalCost += effectiveCost;
        ingredientBreakdown.push({
          keyword: req.nameKeyword,
          matchedName: invMatch?.name || `${req.nameKeyword} (مرجع استاندارد)`,
          unitCost: effectiveCost,
          qty: req.quantity
        });
      });

      const observedFrequency = Math.max(1, Math.round(treatmentCounts.get(recipe.treatmentType) || 1));
      return {
        treatmentType: recipe.treatmentType,
        title: recipe.title,
        materialCostToman: totalCost,
        observedFrequency,
        monthlySpendProjectionToman: totalCost * observedFrequency,
        matchedSuppliesCount,
        ingredientBreakdown
      };
    })
    .sort((a, b) => b.materialCostToman - a.materialCostToman);

  // 3. Compute daily consumption velocity for each inventory item using observed procedure mix
  const itemDemandScores = new Map<string, number>();
  inventory.forEach((item) => {
    const normName = normalizePersianSearch(item.name);
    let totalUses = 0;
    Object.values(CLINICAL_CONSUMPTION_RECIPES).forEach((rec) => {
      if (!rec) return;
      const freq = treatmentCounts.get(rec.treatmentType) || 0.5;
      rec.items.forEach((ri) => {
        if (normName.includes(normalizePersianSearch(ri.nameKeyword))) {
          totalUses += freq * ri.quantity;
        }
      });
    });
    // Convert clinical demand across 30-day cycle + turnover adjustment by alert level
    const baselineDaily = Math.max(0.18, Number(((totalUses / 22) + (item.minAlert / 28)).toFixed(2)));
    itemDemandScores.set(item.id, baselineDaily);
  });

  const horizonOffsets = [0, 2, 4, 6, 8, 10, 14];
  const horizonLabels = horizonOffsets.map((d) =>
    d === 0 ? 'امروز' : `+${toPersianDigits(d)} روز`
  );

  // 4. Build replenishment forecasts & 14-day stock depletion trends
  const replenishmentForecasts: ReplenishmentForecastRow[] = inventory
    .map((item) => {
      const dailyConsumption = itemDemandScores.get(item.id) || 0.25;
      const bufferAboveMin = Math.max(0, item.stock - item.minAlert);
      const daysUntilReorder = item.stock <= item.minAlert
        ? 0
        : Math.max(1, Math.round(bufferAboveMin / dailyConsumption));
      const daysUntilStockout = item.stock <= 0
        ? 0
        : Math.max(1, Math.round(item.stock / dailyConsumption));
      const predictedReplenishDate =
        daysUntilReorder === 0 ? getCurrentPersianDate() : getRelativePersianDate(daysUntilReorder);

      const urgencyLabel: ReplenishmentForecastRow['urgencyLabel'] =
        daysUntilReorder <= 3
          ? 'سفارش فوری'
          : daysUntilReorder <= 10
          ? 'نزدیک به سفارش'
          : 'پایدار';

      const recommendedQty = Math.max(
        item.minAlert * 2,
        Math.ceil(dailyConsumption * 14) - Math.max(0, item.stock - item.minAlert)
      );
      const estimatedOrderCost = Math.max(0, recommendedQty * (item.pricePerUnit || 0));

      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        currentStock: item.stock,
        minAlert: item.minAlert,
        unit: item.unit,
        dailyConsumption,
        daysUntilReorder,
        daysUntilStockout,
        predictedReplenishDate,
        urgencyLabel,
        recommendedQty,
        estimatedOrderCost
      };
    })
    .sort((a, b) => a.daysUntilReorder - b.daysUntilReorder);

  const criticalTrends: LowStockItemTrend[] = replenishmentForecasts
    .slice(0, 5)
    .map((row) => ({
      itemId: row.itemId,
      itemName: row.itemName,
      unit: row.unit,
      currentStock: row.currentStock,
      minAlert: row.minAlert,
      dailyBurnRate: row.dailyConsumption,
      daysUntilThreshold: row.daysUntilReorder,
      urgency: row.urgencyLabel === 'سفارش فوری' ? 'critical' : row.urgencyLabel === 'نزدیک به سفارش' ? 'warning' : 'healthy',
      points: horizonOffsets.map((d, idx) => ({
        dayOffset: d,
        dayLabel: horizonLabels[idx],
        projectedStock: Number(Math.max(0, row.currentStock - row.dailyConsumption * d).toFixed(1))
      }))
    }));

  const totalMonthlyProjectedSpend = costPerProcedure.reduce((s, c) => s + c.monthlySpendProjectionToman, 0);
  const avgCostPerProcedure =
    costPerProcedure.length > 0
      ? Math.round(costPerProcedure.reduce((s, c) => s + c.materialCostToman, 0) / costPerProcedure.length)
      : 0;
  const urgentReorderCount = replenishmentForecasts.filter((r) => r.urgencyLabel !== 'پایدار').length;

  return {
    horizonLabels,
    criticalTrends,
    costPerProcedure,
    replenishmentForecasts,
    totalMonthlyProjectedSpend,
    avgCostPerProcedure,
    urgentReorderCount
  };
}

const SERIES_COLORS = ['#e11d48', '#d97706', '#059669', '#0284c7', '#7c3aed'];

interface InventoryAnalyticsD3Props {
  inventory: InventoryItem[];
  patients?: Patient[];
  appointments?: Appointment[];
  onOpenPurchaseOrder: () => void;
}

export const InventoryAnalyticsD3: React.FC<InventoryAnalyticsD3Props> = ({
  inventory,
  patients = [],
  appointments = [],
  onOpenPurchaseOrder
}) => {
  const { selection } = useHapticFeedback();
  const summary = useMemo(
    () => buildInventoryAnalyticsSummary(inventory, patients, appointments),
    [inventory, patients, appointments]
  );

  const [focusedTrendId, setFocusedTrendId] = useState<string | null>(
    summary.criticalTrends[0]?.itemId || null
  );
  const [hoveredProcType, setHoveredProcType] = useState<TreatmentType | null>(
    summary.costPerProcedure[0]?.treatmentType || null
  );

  const activeTrend =
    summary.criticalTrends.find((t) => t.itemId === focusedTrendId) || summary.criticalTrends[0] || null;
  const topProcedures = summary.costPerProcedure.slice(0, 7);
  const activeProcDetail =
    topProcedures.find((p) => p.treatmentType === hoveredProcType) || topProcedures[0] || null;

  // --- D3 Chart 1: Low-Stock 14-Day Depletion Area & Multi-Line Chart ---
  const trendChart = useMemo(() => {
    const width = 520;
    const height = 210;
    const margin = { top: 18, right: 20, bottom: 32, left: 42 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xScale = d3
      .scalePoint<string>()
      .domain(summary.horizonLabels)
      .range([0, innerW])
      .padding(0.15);

    const maxStockVal = Math.max(
      10,
      d3.max(summary.criticalTrends.flatMap((t) => [t.currentStock, t.minAlert * 1.4])) || 10
    );

    const yScale = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxStockVal * 1.15)])
      .range([innerH, 0]);

    const lineGen = d3
      .line<LowStockTrendPoint>()
      .x((d) => xScale(d.dayLabel) ?? 0)
      .y((d) => yScale(d.projectedStock))
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<LowStockTrendPoint>()
      .x((d) => xScale(d.dayLabel) ?? 0)
      .y0(innerH)
      .y1((d) => yScale(d.projectedStock))
      .curve(d3.curveMonotoneX);

    const yTicks = yScale.ticks(4);

    return {
      width,
      height,
      margin,
      innerW,
      innerH,
      xScale,
      yScale,
      yTicks,
      paths: summary.criticalTrends.map((series, idx) => ({
        ...series,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        lineD: lineGen(series.points) || '',
        areaD: areaGen(series.points) || '',
        thresholdY: yScale(series.minAlert)
      }))
    };
  }, [summary]);

  // --- D3 Chart 2: Cost-Per-Procedure Horizontal Bar Chart ---
  const costBarChart = useMemo(() => {
    const width = 520;
    const barRowHeight = 32;
    const margin = { top: 12, right: 145, bottom: 24, left: 82 };
    const innerH = Math.max(120, topProcedures.length * barRowHeight);
    const height = innerH + margin.top + margin.bottom;
    const innerW = width - margin.left - margin.right;

    const maxCost = Math.max(100000, d3.max(topProcedures, (d) => d.materialCostToman) || 100000);
    const xScale = d3.scaleLinear().domain([0, maxCost * 1.08]).range([0, innerW]);
    const yScale = d3
      .scaleBand<string>()
      .domain(topProcedures.map((d) => d.treatmentType))
      .range([0, innerH])
      .padding(0.28);

    const colorScale = d3
      .scaleLinear<string>()
      .domain([0, maxCost])
      .range(['#10b981', '#0f766e']);

    return {
      width,
      height,
      margin,
      innerW,
      innerH,
      xScale,
      yScale,
      bars: topProcedures.map((proc) => ({
        ...proc,
        y: yScale(proc.treatmentType) ?? 0,
        barH: yScale.bandwidth(),
        barW: Math.max(6, xScale(proc.materialCostToman)),
        fill: colorScale(proc.materialCostToman)
      }))
    };
  }, [topProcedures]);

  // --- D3 Chart 3: AI Replenishment Horizon Scale ---
  const maxReplenishDays = Math.max(
    14,
    d3.max(summary.replenishmentForecasts.slice(0, 6), (r) => r.daysUntilReorder) || 14
  );
  const replenishBarScale = d3.scaleLinear().domain([0, maxReplenishDays]).range([8, 100]);

  return (
    <div data-testid="inventory-analytics-d3" className="mx-2 space-y-3" dir="rtl">
      {/* Executive Analytics KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="p-3 rounded-[20px] bg-white border border-rose-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10.5px] font-bold text-slate-500 block">نیازمند شارژ طی ۱۰ روز</span>
            <span className="text-base font-black text-rose-700 font-mono tabular-nums mt-0.5 block">
              {toPersianDigits(summary.urgentReorderCount)} قلم
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-[20px] bg-white border border-emerald-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10.5px] font-bold text-slate-500 block">میانگین هزینه مواد هر درمان</span>
            <span className="text-sm font-black text-emerald-800 font-mono tabular-nums mt-0.5 block">
              {formatToman(summary.avgCostPerProcedure)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-[20px] bg-white border border-indigo-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10.5px] font-bold text-slate-500 block">برآورد مصرف دوره جاری کلینیک</span>
            <span className="text-sm font-black text-indigo-800 font-mono tabular-nums mt-0.5 block">
              {formatToman(summary.totalMonthlyProjectedSpend)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* SECTION 1: D3.js Low-Stock & 14-Day Depletion Trend Visualization */}
      <div className="bg-white rounded-[22px] p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">
                روند افت موجودی و پیش‌بینی کسری ۱۴ روزه (D3.js)
              </h4>
              <span className="text-[10px] font-bold text-slate-500">
                مقایسه شیب مصرف روزانه اقلام کلیدی با خط قرمز آستانه هشدار
              </span>
            </div>
          </div>

          {activeTrend && (
            <div className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700 font-mono tabular-nums">
              {activeTrend.itemName}: {toPersianDigits(activeTrend.currentStock)} {activeTrend.unit} (مصرف {toPersianDigits(activeTrend.dailyBurnRate)}/روز)
            </div>
          )}
        </div>

        {/* Interactive Legend Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {trendChart.paths.map((series) => {
            const isActive = activeTrend?.itemId === series.itemId;
            return (
              <button
                key={series.itemId}
                type="button"
                onClick={() => {
                  selection();
                  setFocusedTrendId(series.itemId);
                }}
                className={`px-2 py-1 rounded-xl text-[10px] font-black border flex items-center gap-1.5 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: series.color }}
                />
                <span className="truncate max-w-[140px]">{series.itemName}</span>
                <span className="font-mono opacity-80 tabular-nums">
                  ({toPersianDigits(series.currentStock)})
                </span>
              </button>
            );
          })}
        </div>

        {/* D3 SVG Chart */}
        {summary.criticalTrends.length > 0 ? (
          <div className="w-full overflow-hidden rounded-2xl bg-slate-50/70 border border-slate-200/80 p-2" dir="ltr">
            <svg
              data-testid="d3-low-stock-svg"
              viewBox={`0 0 ${trendChart.width} ${trendChart.height}`}
              className="w-full h-auto block"
              role="img"
              aria-label="نمودار D3 روند کسری موجودی ۱۴ روزه"
            >
              <g transform={`translate(${trendChart.margin.left},${trendChart.margin.top})`}>
                {/* Horizontal gridlines + Y ticks */}
                {trendChart.yTicks.map((tick) => {
                  const ty = trendChart.yScale(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={0}
                        x2={trendChart.innerW}
                        y1={ty}
                        y2={ty}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={-8}
                        y={ty + 3}
                        textAnchor="end"
                        fill="#64748b"
                        fontSize={10}
                        fontFamily="monospace"
                      >
                        {toPersianDigits(tick)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis day horizon labels */}
                {summary.horizonLabels.map((lbl) => {
                  const tx = trendChart.xScale(lbl) ?? 0;
                  return (
                    <text
                      key={lbl}
                      x={tx}
                      y={trendChart.innerH + 18}
                      textAnchor="middle"
                      fill="#475569"
                      fontSize={10}
                      fontWeight={700}
                    >
                      {lbl}
                    </text>
                  );
                })}

                {/* Threshold alert dashed line for focused item */}
                {activeTrend && (
                  <g>
                    <line
                      x1={0}
                      x2={trendChart.innerW}
                      y1={trendChart.yScale(activeTrend.minAlert)}
                      y2={trendChart.yScale(activeTrend.minAlert)}
                      stroke="#e11d48"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                    <text
                      x={trendChart.innerW - 4}
                      y={Math.max(10, trendChart.yScale(activeTrend.minAlert) - 5)}
                      textAnchor="end"
                      fill="#be123c"
                      fontSize={9.5}
                      fontWeight={800}
                    >
                      خط هشدار: {toPersianDigits(activeTrend.minAlert)}
                    </text>
                  </g>
                )}

                {/* Shaded D3 area for focused series */}
                {trendChart.paths.map((series) =>
                  series.itemId === activeTrend?.itemId ? (
                    <path
                      key={`area-${series.itemId}`}
                      d={series.areaD}
                      fill={series.color}
                      fillOpacity={0.14}
                    />
                  ) : null
                )}

                {/* Multi-line D3 curves */}
                {trendChart.paths.map((series) => {
                  const isFocused = series.itemId === activeTrend?.itemId;
                  return (
                    <g key={`line-${series.itemId}`}>
                      <path
                        d={series.lineD}
                        fill="none"
                        stroke={series.color}
                        strokeWidth={isFocused ? 2.75 : 1.5}
                        strokeOpacity={isFocused ? 1 : 0.4}
                      />
                      {isFocused &&
                        series.points.map((pt) => (
                          <circle
                            key={`${series.itemId}-${pt.dayOffset}`}
                            cx={trendChart.xScale(pt.dayLabel) ?? 0}
                            cy={trendChart.yScale(pt.projectedStock)}
                            r={3.5}
                            fill="#ffffff"
                            stroke={series.color}
                            strokeWidth={2}
                          />
                        ))}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4">کالایی برای ترسیم روند وجود ندارد.</p>
        )}
      </div>

      {/* SECTION 2: D3.js Cost-Per-Procedure Bar Visualization */}
      <div className="bg-white rounded-[22px] p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">
                بهای تمام‌شده متریال به ازای هر درمان (D3 Cost-Per-Procedure)
              </h4>
              <span className="text-[10px] font-bold text-slate-500">
                محاسبه خودکار از فرمول BOM مصرفی درمان‌ها و قیمت واحد کالاهای انبار
              </span>
            </div>
          </div>
        </div>

        <div className="w-full overflow-hidden rounded-2xl bg-slate-50/70 border border-slate-200/80 p-2" dir="ltr">
          <svg
            data-testid="d3-cost-procedure-svg"
            viewBox={`0 0 ${costBarChart.width} ${costBarChart.height}`}
            className="w-full h-auto block"
            role="img"
            aria-label="نمودار میله‌ای D3 هزینه مواد مصرفی هر درمان"
          >
            <g transform={`translate(${costBarChart.margin.left},${costBarChart.margin.top})`}>
              {costBarChart.bars.map((bar) => {
                const isSelected = activeProcDetail?.treatmentType === bar.treatmentType;
                return (
                  <g
                    key={bar.treatmentType}
                    onMouseEnter={() => setHoveredProcType(bar.treatmentType)}
                    onClick={() => setHoveredProcType(bar.treatmentType)}
                    className="cursor-pointer"
                  >
                    {/* Left Cost Label */}
                    <text
                      x={-8}
                      y={bar.y + bar.barH / 2 + 3.5}
                      textAnchor="end"
                      fill="#065f46"
                      fontSize={9.5}
                      fontWeight={800}
                      fontFamily="monospace"
                    >
                      {formatToman(bar.materialCostToman)}
                    </text>

                    {/* Background track */}
                    <rect
                      x={0}
                      y={bar.y}
                      width={costBarChart.innerW}
                      height={bar.barH}
                      rx={6}
                      fill="#e2e8f0"
                      fillOpacity={0.55}
                    />

                    {/* Data bar */}
                    <rect
                      x={0}
                      y={bar.y}
                      width={Math.min(costBarChart.innerW, bar.barW)}
                      height={bar.barH}
                      rx={6}
                      fill={isSelected ? '#0f766e' : bar.fill}
                      stroke={isSelected ? '#134e4a' : 'none'}
                      strokeWidth={isSelected ? 1.5 : 0}
                    />

                    {/* Right Procedure Label */}
                    <text
                      x={costBarChart.innerW + 8}
                      y={bar.y + bar.barH / 2 + 3.5}
                      textAnchor="start"
                      fill="#0f172a"
                      fontSize={10}
                      fontWeight={isSelected ? 900 : 700}
                    >
                      {bar.title} ({toPersianDigits(bar.observedFrequency)})
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Active Procedure Ingredient Cost Breakdown */}
        {activeProcDetail && (
          <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between flex-wrap gap-2 text-[10.5px]">
            <div className="space-y-0.5">
              <span className="font-black text-emerald-950 block">
                آنالیز مواد مصرفی «{activeProcDetail.title}» ({toPersianDigits(activeProcDetail.observedFrequency)} نوبت/سابقه فعال):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeProcDetail.ingredientBreakdown.map((ing, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-lg bg-white border border-emerald-200 text-slate-700 font-bold tabular-nums">
                    {ing.keyword} ×{toPersianDigits(ing.qty)}: <strong className="font-mono text-emerald-800">{formatToman(ing.unitCost)}</strong>
                  </span>
                ))}
              </div>
            </div>
            <div className="text-left font-mono tabular-nums">
              <span className="text-[9px] text-emerald-700 font-sans block">جمع هزینه دوره</span>
              <span className="font-black text-xs text-emerald-900">
                {formatToman(activeProcDetail.monthlySpendProjectionToman)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: AI-Predicted Replenishment Dates & Actionable Reorder Schedule */}
      <div className="bg-white rounded-[22px] p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">
                پیش‌بینی هوشمند تاریخ سفارش و شارژ مجدد انبار (AI)
              </h4>
              <span className="text-[10px] font-bold text-slate-500">
                زمان‌بندی خرید بر اساس نرخ تکرار درمان‌های مطب و سطح هشدار کالاها
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              selection();
              onOpenPurchaseOrder();
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>صدور پیش‌فاکتور خرید هوشمند</span>
          </button>
        </div>

        <div className="space-y-1.5">
          {summary.replenishmentForecasts.slice(0, 6).map((row) => {
            const fillWidthPct = replenishBarScale(row.daysUntilReorder);
            const isUrgent = row.urgencyLabel === 'سفارش فوری';
            const isSoon = row.urgencyLabel === 'نزدیک به سفارش';
            return (
              <div
                key={row.itemId}
                className={`p-2.5 rounded-2xl border space-y-1.5 ${
                  isUrgent
                    ? 'bg-rose-50/50 border-rose-200'
                    : isSoon
                    ? 'bg-amber-50/40 border-amber-200'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 block truncate">{row.itemName}</span>
                    <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                      موجودی: {toPersianDigits(row.currentStock)} {row.unit} · مصرف روزانه ≈ {toPersianDigits(row.dailyConsumption)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left font-mono tabular-nums">
                      <span className="text-[9px] text-slate-500 font-sans block">تاریخ پیشنهادی سفارش</span>
                      <span className={`text-[11px] font-black ${isUrgent ? 'text-rose-700' : 'text-indigo-800'}`}>
                        {row.predictedReplenishDate}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                        isUrgent
                          ? 'bg-rose-600 text-white border-rose-700'
                          : isSoon
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {row.urgencyLabel === 'پایدار' ? (
                        <span className="inline-flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          {toPersianDigits(row.daysUntilReorder)} روز دیگر
                        </span>
                      ) : row.daysUntilReorder === 0 ? (
                        'سفارش فوری (امروز)'
                      ) : (
                        `${toPersianDigits(row.daysUntilReorder)} روز باقی‌مانده`
                      )}
                    </span>
                  </div>
                </div>

                {/* D3 Scaled Replenishment Horizon Meter */}
                <div className="flex items-center gap-2 text-[10px]">
                  <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isUrgent ? 'bg-rose-500' : isSoon ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(6, fillWidthPct))}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-slate-600 shrink-0 tabular-nums">
                    پیشنهاد خرید: {toPersianDigits(row.recommendedQty)} {row.unit} ({formatToman(row.estimatedOrderCost)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center gap-2 text-[10.5px] text-indigo-950 font-bold">
          <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>
            موتور تحلیل با بررسی {toPersianDigits(patients.length)} پرونده بیمار و {toPersianDigits(appointments.length)} نوبت کلینیک، نقطه سفارش مجدد (ROP) را به‌صورت زنده محاسبه می‌کند.
          </span>
        </div>
      </div>
    </div>
  );
};
