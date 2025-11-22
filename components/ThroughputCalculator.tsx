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

type Source = {
  id: "inbound" | "paid" | "outbound" | "partner";
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
  { id: "outbound", label: "Outbound and SDR", share: 15 },
  { id: "partner", label: "Partners and integrations", share: 10 }
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
    label: "Better MQL quality (+5pp MQL to SQL)",
    description: "Improve qualification, scoring and handover rules.",
    adjustments: [{ stageId: "mql", conversionDelta: 5 }]
  },
  {
    id: "velocity_boost",
    label: "Faster sales cycle",
    description: "Shorten cycle time with better enablement and clearer offers.",
    adjustments: [
      { stageId: "sql", velocityDelta: -5 },
      { stageId: "opps", velocityDelta: -5 }
    ]
  }
];

function applyScenario(
  stages: FunnelStage[],
  scenario: Scenario
): FunnelStage[] {
  if (!scenario || scenario.id === "baseline") return stages;

  return stages.map((stage) => {
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

type ThroughputResult = {
  stageVolumes: Record<FunnelStageId, number>;
  totalCycleDays: number;
  arr: number;
  bottleneckStageId: FunnelStageId | null;
  pressureScores: Record<FunnelStageId, number>;
};

function calculateThroughput(
  stages: FunnelStage[],
  monthlyVisitors: number,
  avgDealSize: number,
  winRate?: number
): ThroughputResult {
  const ordered = stages;

  const stageVolumes: Record<FunnelStageId, number> = {
    visitors: monthlyVisitors,
    leads: 0,
    mql: 0,
    sql: 0,
    opps: 0,
    wins: 0
  };

  let current = monthlyVisitors;

  ordered.forEach((stage, index) => {
    if (index === 0) {
      stageVolumes[stage.id] = current;
      return;
    }
    const rate = stage.conversionRate / 100;
    current = current * rate;
    stageVolumes[stage.id] = current;
  });

  if (winRate !== undefined) {
    stageVolumes.wins = stageVolumes.opps * (winRate / 100);
  }

  const totalCycleDays = ordered.reduce(
    (sum, stage) => sum + stage.velocityDays,
    0
  );

  const arr = stageVolumes.wins * avgDealSize * 12;

  const pressureScores: Record<FunnelStageId, number> = {
    visitors: 0,
    leads: 0,
    mql: 0,
    sql: 0,
    opps: 0,
    wins: 0
  };

  ordered.forEach((stage, index) => {
    if (index === 0) return;
    const convScore = 100 - stage.conversionRate;
    const velScore = stage.velocityDays;
    pressureScores[stage.id] = convScore * 0.7 + velScore * 0.3;
  });

  const sorted = ordered.slice(1).sort((a, b) => {
    return (
      pressureScores[b.id as FunnelStageId] -
      pressureScores[a.id as FunnelStageId]
    );
  });

  const bottleneckStageId = sorted[0]?.id ?? null;

  return { stageVolumes, totalCycleDays, arr, bottleneckStageId, pressureScores };
}

const ThroughputCalculator: React.FC = () => {
  const [stages, setStages] = useState<FunnelStage[]>(defaultStages);
  const [sources, setSources] = useState<Source[]>(defaultSources);
  const [monthlyVisitors, setMonthlyVisitors] = useState(20000);
  const [avgDealSize, setAvgDealSize] = useState(8000);
  const [winRate, setWinRate] = useState<number | undefined>(undefined);
  const [selectedScenarioId, setSelectedScenarioId] = useState("baseline");

  const selectedScenario =
    scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const stagesWithScenario = useMemo(
    () => applyScenario(stages, selectedScenario),
    [stages, selectedScenario]
  );

  const result = useMemo(
    () =>
      calculateThroughput(
        stagesWithScenario,
        monthlyVisitors,
        avgDealSize,
        winRate
      ),
    [stagesWithScenario, monthlyVisitors, avgDealSize, winRate]
  );

  const totalSourceShare = sources.reduce((sum, s) => sum + s.share, 0);

  return (
    <div className="space-y-8">
      {/* Top cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Projected ARR
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">
            €
            {result.arr.toLocaleString(undefined, {
              maximumFractionDigits: 0
            })}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Based on current funnel inputs and win rate.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Total funnel cycle time
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {result.totalCycleDays} days
          </div>
          <p className="mt-1 text-xs text-slate-400">
            From first touch to closed won, across all stages.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Primary bottleneck
          </div>
          <div className="mt-1 text-lg font-semibold">
            {result.bottleneckStageId
              ? stagesWithScenario.find(
                  (s) => s.id === result.bottleneckStageId
                )?.label
              : "None detected"}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Stage with the tightest combination of low conversion and slow
            velocity.
          </p>
        </div>
      </div>

      {/* Scenario selector */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm">Scenario</h3>
            <p className="text-xs text-slate-400">
              Compare current performance with potential improvements.
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
              Funnel stages
            </h4>
            <div className="space-y-2 text-xs">
              {stagesWithScenario.map((stage, index) => (
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
                        setStages((prev) =>
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
                        setStages((prev) =>
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
            Shape your channel mix to see how it supports the overall pipeline.
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
              Funnel snapshot (per month)
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>Visitors to Leads</span>
              <span className="text-right">
                {Math.round(result.stageVolumes.visitors)} →{" "}
                {Math.round(result.stageVolumes.leads)}
              </span>
              <span>Leads to MQL</span>
              <span className="text-right">
                {Math.round(result.stageVolumes.leads)} →{" "}
                {Math.round(result.stageVolumes.mql)}
              </span>
              <span>MQL to SQL</span>
              <span className="text-right">
                {Math.round(result.stageVolumes.mql)} →{" "}
                {Math.round(result.stageVolumes.sql)}
              </span>
              <span>SQL to Opps</span>
              <span className="text-right">
                {Math.round(result.stageVolumes.sql)} →{" "}
                {Math.round(result.stageVolumes.opps)}
              </span>
              <span>Opps to Wins</span>
              <span className="text-right">
                {Math.round(result.stageVolumes.opps)} →{" "}
                {Math.round(result.stageVolumes.wins)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottleneck insights */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h3 className="font-semibold text-sm">Bottleneck and experiment ideas</h3>
        <p className="text-xs text-slate-400">
          Use this section to frame your narrative in leadership or interview
          sessions. Fix the tightest bottleneck first, then re-run the model.
        </p>
        {result.bottleneckStageId && (
          <div className="text-xs text-slate-200">
            <span className="font-medium">
              Primary bottleneck:{" "}
              {
                stagesWithScenario.find(
                  (s) => s.id === result.bottleneckStageId
                )?.label
              }
            </span>
            <ul className="mt-2 list-disc list-inside space-y-1 text-slate-300">
              {result.bottleneckStageId === "mql" && (
                <>
                  <li>
                    Tighten MQL definition, scoring and routing so sales only see
                    higher intent leads.
                  </li>
                  <li>
                    Refresh lead magnets and forms to capture richer qualifying data.
                  </li>
                  <li>
                    Launch nurture tracks tailored to segment, problem and intent.
                  </li>
                </>
              )}
              {result.bottleneckStageId === "sql" && (
                <>
                  <li>
                    Introduce pre-demo discovery flows or qualification calls to
                    reduce no shows and misfits.
                  </li>
                  <li>
                    Improve sales talk tracks around core use cases and value.
                  </li>
                  <li>
                    Share more product context and recordings with sales to align
                    on what a good SQL looks like.
                  </li>
                </>
              )}
              {result.bottleneckStageId === "opps" && (
                <>
                  <li>
                    Add ROI models and proof of value programs to support late
                    stage buyers.
                  </li>
                  <li>
                    Multi thread into more stakeholders inside target accounts.
                  </li>
                  <li>
                    Simplify commercial offers to shorten approvals and risk reviews.
                  </li>
                </>
              )}
              {(result.bottleneckStageId === "leads" ||
                result.bottleneckStageId === "visitors") && (
                <>
                  <li>
                    Test new traffic sources and higher intent content, such as
                    comparisons and buyer guides.
                  </li>
                  <li>
                    Run conversion experiments on top landing pages and sign up flows.
                  </li>
                  <li>
                    Expand partner and integration led campaigns to tap into
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
