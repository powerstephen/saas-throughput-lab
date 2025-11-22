"use client";

import React, { useMemo, useState } from "react";

type FunnelStageId =
  | "visitors"
  | "leads"
  | "mql"
  | "sql"
  | "opps"
  | "wins";

type FunnelStage = {
  id: FunnelStageId;
  label: string;
  conversionRate: number; // 0–100 (%)
  velocityDays: number;
};

type SourceId = "inbound" | "paid" | "outbound" | "partner";

type Source = {
  id: SourceId;
  label: string;
  share: number; // %
};

type Scenario = {
  id: string;
  label: string;
  description: string;
  adjustments: {
    stageId: FunnelStageId;
    conversionDelta?: number;
    velocityDelta?: number;
  }[];
};

type SingleThroughput = {
  stageVolumes: Record<FunnelStageId, number>;
  totalCycleDays: number;
  arr: number;
};

type ThroughputResult = SingleThroughput & {
  bottleneckStageId: FunnelStageId | null;
  pressureScores: Record<FunnelStageId, number>;
  perSource: Record<SourceId, SingleThroughput>;
};

const defaultStages: FunnelStage[] = [
  { id: "visitors", label: "Website Visitors", conversionRate: 5, velocityDays: 3 },
  { id: "leads", label: "Leads", conversionRate: 25, velocityDays: 5 },
  { id: "mql", label: "MQLs", conversionRate: 35, velocityDays: 7 },
  { id: "sql", label: "SQLs", conversionRate: 40, velocityDays: 10 },
  { id: "opps", label: "Opportunities", conversionRate: 30, velocityDays: 20 },
  { id: "wins", label: "Closed Won", conversionRate: 100, velocityDays: 30 }
];

const defaultSources: Source[] = [
  { id: "inbound", label: "Inbound (SEO, content)", share: 40 },
  { id: "paid", label: "Paid (search, social)", share: 35 },
  { id: "outbound", label: "Outbound & SDR", share: 15 },
  { id: "partner", label: "Partners & integrations", share: 10 }
];

const scenarios: Scenario[] = [
  {
    id: "baseline",
    label: "Baseline",
    description: "Current performance without any changes.",
    adjustments: []
  },
  {
    id: "mql_lift",
    label: "+5pp MQL → SQL",
    description: "Tighten MQL definition, scoring, and handover to improve sales acceptance.",
    adjustments: [{ stageId: "mql", conversionDelta: 5 }]
  },
  {
    id: "velocity_boost",
    label: "Faster sales cycle",
    description: "Shorten cycle time with better enablement, offers, and approvals.",
    adjustments: [
      { stageId: "sql", velocityDelta: -5 },
      { stageId: "opps", velocityDelta: -5 }
    ]
  }
];

function applyScenario(baseStages: FunnelStage[], scenario: Scenario): FunnelStage[] {
  if (!scenario || scenario.id === "baseline") return baseStages;

  return baseStages.map((stage) => {
    const adj = scenario.adjustments.find((a) => a.stageId === stage.id);
    if (!adj) return stage;

    return {
      ...stage,
      conversionRate:
        adj.conversionDelta !== undefined
          ? Math.max(
              0,
              Math.min(100, stage.conversionRate + adj.conversionDelta)
            )
          : stage.conversionRate,
      velocityDays:
        adj.velocityDelta !== undefined
          ? Math.max(1, stage.velocityDays + adj.velocityDelta)
          : stage.velocityDays
    };
  });
}

function propagateFunnel(
  stages: FunnelStage[],
  startingVisitors: number,
  avgDealSize: number,
  winRate?: number
): SingleThroughput {
  const stageVolumes: Record<FunnelStageId, number> = {
    visitors: startingVisitors,
    leads: 0,
    mql: 0,
    sql: 0,
    opps: 0,
    wins: 0
  };

  let current = startingVisitors;

  stages.forEach((stage, index) => {
    if (index === 0) {
      stageVolumes[stage.id] = current;
      return;
    }
    const rate =
      stage.id === "wins" && winRate !== undefined
        ? winRate / 100
        : stage.conversionRate / 100;

    current = current * rate;
    stageVolumes[stage.id] = current;
  });

  const totalCycleDays = stages.reduce(
    (sum, stage) => sum + stage.velocityDays,
    0
  );

  const arr = stageVolumes.wins * avgDealSize * 12;

  return { stageVolumes, totalCycleDays, arr };
}

function calculateThroughput(
  stages: FunnelStage[],
  monthlyVisitors: number,
  avgDealSize: number,
  winRate: number | undefined,
  sources: Source[]
): ThroughputResult {
  // Overall funnel
  const overall = propagateFunnel(stages, monthlyVisitors, avgDealSize, winRate);

  // Bottleneck scoring (independent of volume)
  const pressureScores: Record<FunnelStageId, number> = {
    visitors: 0,
    leads: 0,
    mql: 0,
    sql: 0,
    opps: 0,
    wins: 0
  };

  stages.forEach((stage, index) => {
    if (index === 0) return;
    const convScore = 100 - stage.conversionRate;
    const velScore = stage.velocityDays;
    pressureScores[stage.id] = convScore * 0.7 + velScore * 0.3;
  });

  const sorted = stages
    .filter((s) => s.id !== "visitors")
    .sort(
      (a, b) =>
        pressureScores[b.id as FunnelStageId] -
        pressureScores[a.id as FunnelStageId]
    );

  const bottleneckStageId = sorted[0]?.id ?? null;

  // Per-source breakdown
  const perSource: Record<SourceId, SingleThroughput> = {
    inbound: propagateFunnel(stages, 0, avgDealSize, winRate),
    paid: propagateFunnel(stages, 0, avgDealSize, winRate),
    outbound: propagateFunnel(stages, 0, avgDealSize, winRate),
    partner: propagateFunnel(stages, 0, avgDealSize, winRate)
  };

  const totalShare = sources.reduce((sum, s) => sum + s.share, 0) || 1;

  sources.forEach((source) => {
    const visitorsForSource = monthlyVisitors * (source.share / totalShare);
    perSource[source.id] = propagateFunnel(
      stages,
      visitorsForSource,
      avgDealSize,
      winRate
    );
  });

  return {
    ...overall,
    bottleneckStageId,
    pressureScores,
    perSource
  };
}

const ThroughputCalculator: React.FC = () => {
  const [baseStages, setBaseStages] = useState<FunnelStage[]>(defaultStages);
  const [sources, setSources] = useState<Source[]>(defaultSources);
  const [monthlyVisitors, setMonthlyVisitors] = useState(20000);
  const [avgDealSize, setAvgDealSize] = useState(8000);
  const [winRate, setWinRate] = useState<number | undefined>(20);
  const [selectedScenarioId, setSelectedScenarioId] = useState("baseline");

  const selectedScenario =
    scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const scenarioStages = useMemo(
    () => applyScenario(baseStages, selectedScenario),
    [baseStages, selectedScenario]
  );

  const baselineResult = useMemo(
    () =>
      calculateThroughput(
        baseStages,
        monthlyVisitors,
        avgDealSize,
        winRate,
        sources
      ),
    [baseStages, monthlyVisitors, avgDealSize, winRate, sources]
  );

  const scenarioResult = useMemo(
    () =>
      calculateThroughput(
        scenarioStages,
        monthlyVisitors,
        avgDealSize,
        winRate,
        sources
      ),
    [scenarioStages, monthlyVisitors, avgDealSize, winRate, sources]
  );

  const totalSourceShare = sources.reduce((sum, s) => sum + s.share, 0);

  const arrDelta =
    scenarioResult.arr - baselineResult.arr;

  const arrDeltaPct =
    baselineResult.arr > 0
      ? (arrDelta / baselineResult.arr) * 100
      : 0;

  const winsDelta =
    scenarioResult.stageVolumes.wins - baselineResult.stageVolumes.wins;

  const winsDeltaPct =
    baselineResult.stageVolumes.wins > 0
      ? (winsDelta / baselineResult.stageVolumes.wins) * 100
      : 0;

  const cycleDelta =
    scenarioResult.totalCycleDays - baselineResult.totalCycleDays;

  return (
    <div className="space-y-8">
      {/* Top comparison cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1 text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Projected ARR
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-slate-300 text-xs">Baseline</div>
              <div className="text-lg font-semibold text-slate-50">
                €
                {baselineResult.arr.toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })}
              </div>
            </div>
            <div>
              <div className="text-slate-300 text-xs">Scenario</div>
              <div className="text-lg font-semibold text-emerald-400">
                €
                {scenarioResult.arr.toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })}
              </div>
            </div>
          </div>
          <div className="text-xs text-emerald-300 mt-1">
            Delta: {arrDelta >= 0 ? "+" : "-"}
            {Math.abs(arrDelta).toLocaleString(undefined, {
              maximumFractionDigits: 0
            })}{" "}
            ({arrDeltaPct >= 0 ? "+" : ""}
            {arrDeltaPct.toFixed(1)}%)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1 text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Wins per month
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-slate-300 text-xs">Baseline</div>
              <div className="text-lg font-semibold text-slate-50">
                {baselineResult.stageVolumes.wins.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-slate-300 text-xs">Scenario</div>
              <div className="text-lg font-semibold text-emerald-400">
                {scenarioResult.stageVolumes.wins.toFixed(1)}
              </div>
            </div>
          </div>
          <div className="text-xs text-emerald-300 mt-1">
            Delta: {winsDelta >= 0 ? "+" : "-"}
            {winsDelta.toFixed(1)} ({winsDeltaPct >= 0 ? "+" : ""}
            {winsDeltaPct.toFixed(1)}%)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1 text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Total funnel cycle time
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-slate-300 text-xs">Baseline</div>
              <div className="text-lg font-semibold text-slate-50">
                {baselineResult.totalCycleDays} days
              </div>
            </div>
            <div>
              <div className="text-slate-300 text-xs">Scenario</div>
              <div className="text-lg font-semibold text-emerald-400">
                {scenarioResult.totalCycleDays} days
              </div>
            </div>
          </div>
          <div className="text-xs text-emerald-300 mt-1">
            Delta: {cycleDelta >= 0 ? "+" : ""}
            {cycleDelta} days
          </div>
        </div>
      </div>

      {/* Scenario selector */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm">Scenario</h3>
            <p className="text-xs text-slate-400">
              Compare your current funnel with “what if” improvements.
            </p>
          </div>
          <select
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs"
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.label}
              </option>
            ))}
          </select>
        </div>
        {selectedScenario.description && (
          <p className="mt-2 text-xs text-slate-400">
            {selectedScenario.description}
          </p>
        )}
      </div>

      {/* Inputs */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: funnel inputs */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h3 className="font-semibold text-sm">Funnel inputs</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <span className="text-slate-300 text-xs">
                Monthly website visitors
              </span>
              <input
                type="number"
                value={monthlyVisitors}
                onChange={(e) =>
                  setMonthlyVisitors(Number(e.target.value) || 0)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-300 text-xs">Average deal size (€)</span>
              <input
                type="number"
                value={avgDealSize}
                onChange={(e) => setAvgDealSize(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-300 text-xs">Win rate (%)</span>
              <input
                type="number"
                value={winRate ?? ""}
                onChange={(e) =>
                  setWinRate(
                    e.target.value === "" ? undefined : Number(e.target.value) || 0
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <h4 className="font-medium text-xs text-slate-200">
              Funnel stages (baseline)
            </h4>
            <p className="text-xs text-slate-400">
              Edit your current reality. Scenarios apply deltas on top of this.
            </p>
            <div className="space-y-2 text-xs">
              {baseStages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="grid grid-cols-[1.8fr,1fr,1fr] gap-2 items-center"
                >
                  <div className="font-medium text-slate-200">
                    {index + 1}. {stage.label}
                  </div>
                  <label className="flex items-center gap-1">
                    <span className="text-slate-400">Conv%</span>
                    <input
                      type="number"
                      value={stage.conversionRate}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setBaseStages((prev) =>
                          prev.map((s) =>
                            s.id === stage.id ? { ...s, conversionRate: val } : s
                          )
                        );
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-slate-400">Days</span>
                    <input
                      type="number"
                      value={stage.velocityDays}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setBaseStages((prev) =>
                          prev.map((s) =>
                            s.id === stage.id ? { ...s, velocityDays: val } : s
                          )
                        );
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: pipeline sources and snapshot */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h3 className="font-semibold text-sm">Pipeline sources</h3>
          <p className="text-xs text-slate-400">
            Model how your channel mix supports the overall pipeline.
          </p>
          <div className="space-y-2 text-xs">
            {sources.map((source) => (
              <div
                key={source.id}
                className="grid grid-cols-[1.6fr,1fr] gap-2 items-center"
              >
                <div className="font-medium text-slate-200">
                  {source.label}
                </div>
                <label className="flex items-center gap-1">
                  <span className="text-slate-400">Share%</span>
                  <input
                    type="number"
                    value={source.share}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSources((prev) =>
                        prev.map((s) =>
                          s.id === source.id ? { ...s, share: val } : s
                        )
                      );
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1"
                  />
                </label>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total: {totalSourceShare}%{" "}
            {totalSourceShare !== 100 && "(tip: aim for about 100 percent)"}
          </p>

          <div className="mt-4 rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-xs space-y-2">
            <div className="font-semibold text-slate-100">
              Funnel snapshot (baseline, per month)
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>Visitors to Leads</span>
              <span className="text-right">
                {Math.round(baselineResult.stageVolumes.visitors)} →{" "}
                {Math.round(baselineResult.stageVolumes.leads)}
              </span>
              <span>Leads to MQL</span>
              <span className="text-right">
                {Math.round(baselineResult.stageVolumes.leads)} →{" "}
                {Math.round(baselineResult.stageVolumes.mql)}
              </span>
              <span>MQL to SQL</span>
              <span className="text-right">
                {Math.round(baselineResult.stageVolumes.mql)} →{" "}
                {Math.round(baselineResult.stageVolumes.sql)}
              </span>
              <span>SQL to Opps</span>
              <span className="text-right">
                {Math.round(baselineResult.stageVolumes.sql)} →{" "}
                {Math.round(baselineResult.stageVolumes.opps)}
              </span>
              <span>Opps to Wins</span>
              <span className="text-right">
                {Math.round(baselineResult.stageVolumes.opps)} →{" "}
                {Math.round(baselineResult.stageVolumes.wins)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-source comparison for scenario */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-xs">
        <h3 className="font-semibold text-sm">
          Scenario impact by source (wins & ARR / month)
        </h3>
        <p className="text-slate-400">
          Use this to tell the story of where marketing and sales effort should
          go first. Values are for the selected scenario.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4 text-right">Wins / month</th>
                <th className="py-2 pr-4 text-right">ARR / year (€)</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const res = scenarioResult.perSource[source.id];
                return (
                  <tr
                    key={source.id}
                    className="border-b border-slate-900 last:border-0"
                  >
                    <td className="py-2 pr-4">{source.label}</td>
                    <td className="py-2 pr-4 text-right">
                      {res.stageVolumes.wins.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      €
                      {res.arr.toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottleneck & experiment ideas */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-xs">
        <h3 className="font-semibold text-sm">Bottleneck and experiment ideas</h3>
        <p className="text-slate-400">
          Fix the tightest bottleneck first, then re-run the model and see how
          ARR and wins move by source.
        </p>
        {baselineResult.bottleneckStageId && (
          <div className="text-slate-200">
            <span className="font-medium">
              Primary bottleneck (baseline):{" "}
              {
                baseStages.find(
                  (s) => s.id === baselineResult.bottleneckStageId
                )?.label
              }
            </span>
            <ul className="mt-2 list-disc list-inside space-y-1 text-slate-300">
              {baselineResult.bottleneckStageId === "mql" && (
                <>
                  <li>
                    Tighten MQL definition, scoring, and routing so sales only see
                    higher intent leads.
                  </li>
                  <li>
                    Refresh lead magnets and forms to capture richer qualifying data.
                  </li>
                  <li>
                    Launch nurture tracks tailored to segment, problem, and intent.
                  </li>
                </>
              )}
              {baselineResult.bottleneckStageId === "sql" && (
                <>
                  <li>
                    Add pre-demo discovery or qualification steps to reduce no
                    shows and misfit meetings.
                  </li>
                  <li>
                    Improve talk tracks and proof for core use cases and segments.
                  </li>
                  <li>
                    Share more product context and recordings with sales to align
                    on what a good SQL looks like.
                  </li>
                </>
              )}
              {baselineResult.bottleneckStageId === "opps" && (
                <>
                  <li>
                    Introduce ROI models and pilots to de-risk decisions for
                    buying committees.
                  </li>
                  <li>
                    Multi-thread into finance, operations, and IT earlier.
                  </li>
                  <li>
                    Simplify commercial packaging to shorten approvals.
                  </li>
                </>
              )}
              {(baselineResult.bottleneckStageId === "leads" ||
                baselineResult.bottleneckStageId === "visitors") && (
                <>
                  <li>
                    Test new traffic sources and higher-intent content (comparisons,
                    buyer guides, calculators).
                  </li>
                  <li>
                    Run CRO experiments on key landing pages and sign-up flows.
                  </li>
                  <li>
                    Expand partner and integration-led campaigns to tap into
                    existing demand pools.
                  </li>
                </>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThroughputCalculator;
