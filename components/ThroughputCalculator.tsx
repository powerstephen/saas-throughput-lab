"use client";

import React, { useMemo, useState } from "react";

type FunnelInputs = {
  visitors: number;
  leads: number;
  mqls: number;
  sqls: number;
  opps: number;
  wins: number;
  asp: number; // average selling price
  periodLabel: string;
  periodMonths: number;
};

type Benchmarks = {
  visitorToLead: number;
  leadToMql: number;
  mqlToSql: number;
  sqlToOpp: number;
  oppToWin: number;
  trafficGrowthPercent: number;
};

const defaultBaseline: FunnelInputs = {
  visitors: 25000,
  leads: 2000,
  mqls: 600,
  sqls: 250,
  opps: 90,
  wins: 24,
  asp: 18000,
  periodLabel: "Last 12 months",
  periodMonths: 12,
};

const defaultBenchmarks: Benchmarks = {
  visitorToLead: 8,   // 8%
  leadToMql: 30,      // 30%
  mqlToSql: 45,       // 45%
  sqlToOpp: 65,       // 65%
  oppToWin: 25,       // 25%
  trafficGrowthPercent: 0,
};

function safeRate(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function toCurrency(value: number): string {
  if (!Number.isFinite(value)) return "€0";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ThroughputLab() {
  const [inputs, setInputs] = useState<FunnelInputs>(defaultBaseline);
  const [benchmarks, setBenchmarks] = useState<Benchmarks>(defaultBenchmarks);
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  const baseline = useMemo(() => {
    const {
      visitors,
      leads,
      mqls,
      sqls,
      opps,
      wins,
      asp,
      periodMonths,
      periodLabel,
    } = inputs;

    const vToL = safeRate(leads, visitors);
    const lToM = safeRate(mqls, leads);
    const mToS = safeRate(sqls, mqls);
    const sToO = safeRate(opps, sqls);
    const oToW = safeRate(wins, opps);

    const winsPerMonth =
      periodMonths > 0 ? wins / periodMonths : 0;

    const newArrInPeriod = wins * asp;
    const arrRunRate =
      periodMonths > 0 ? newArrInPeriod * (12 / periodMonths) : 0;

    const conversionRates = [
      { label: "Visitor → Lead", value: vToL },
      { label: "Lead → MQL", value: lToM },
      { label: "MQL → SQL", value: mToS },
      { label: "SQL → Opportunity", value: sToO },
      { label: "Opportunity → Win", value: oToW },
    ];

    return {
      periodLabel,
      periodMonths,
      winsPerMonth,
      arrRunRate,
      conversionRates,
      newArrInPeriod,
    };
  }, [inputs]);

  const projection = useMemo(() => {
    const { visitors, asp, periodMonths } = inputs;
    const {
      visitorToLead,
      leadToMql,
      mqlToSql,
      sqlToOpp,
      oppToWin,
      trafficGrowthPercent,
    } = benchmarks;

    const trafficFactor = 1 + trafficGrowthPercent / 100;
    const adjVisitors = visitors * trafficFactor;

    const leads = adjVisitors * (visitorToLead / 100);
    const mqls = leads * (leadToMql / 100);
    const sqls = mqls * (mqlToSql / 100);
    const opps = sqls * (sqlToOpp / 100);
    const wins = opps * (oppToWin / 100);

    const winsPerPeriod = wins;
    const winsPerMonth =
      periodMonths > 0 ? winsPerPeriod / periodMonths : 0;

    const newArrInPeriod = winsPerPeriod * asp;
    const arrRunRate =
      periodMonths > 0 ? newArrInPeriod * (12 / periodMonths) : 0;

    return {
      adjVisitors,
      winsPerMonth,
      arrRunRate,
      winsPerPeriod,
      newArrInPeriod,
    };
  }, [inputs, benchmarks]);

  const arrLiftAbs = projection.arrRunRate - baseline.arrRunRate;
  const arrLiftPct =
    baseline.arrRunRate > 0
      ? (arrLiftAbs / baseline.arrRunRate) * 100
      : 0;

  // Simple bottleneck vs benchmarks: which stage has the biggest gap to benchmark
  const bottleneck = useMemo(() => {
    const map: { stage: string; gap: number }[] = [];
    const [vToL, lToM, mToS, sToO, oToW] = baseline.conversionRates;

    map.push({
      stage: "Visitor → Lead",
      gap: benchmarks.visitorToLead - vToL.value,
    });
    map.push({
      stage: "Lead → MQL",
      gap: benchmarks.leadToMql - lToM.value,
    });
    map.push({
      stage: "MQL → SQL",
      gap: benchmarks.mqlToSql - mToS.value,
    });
    map.push({
      stage: "SQL → Opportunity",
      gap: benchmarks.sqlToOpp - sToO.value,
    });
    map.push({
      stage: "Opportunity → Win",
      gap: benchmarks.oppToWin - oToW.value,
    });

    // biggest positive gap (benchmark better than current)
    const worst = map.sort((a, b) => b.gap - a.gap)[0];

    return worst && worst.gap > 0 ? worst : null;
  }, [baseline.conversionRates, benchmarks]);

  const handleInputChange = (
    field: keyof FunnelInputs,
    value: string
  ) => {
    setInputs((prev) => ({
      ...prev,
      [field]:
        field === "periodLabel"
          ? value
          : Number.isNaN(parseFloat(value))
          ? 0
          : parseFloat(value),
    }));
  };

  const handleBenchmarkChange = (
    field: keyof Benchmarks,
    value: string
  ) => {
    setBenchmarks((prev) => ({
      ...prev,
      [field]: Number.isNaN(parseFloat(value))
        ? 0
        : parseFloat(value),
    }));
  };

  const resetBenchmarks = () => {
    setBenchmarks(defaultBenchmarks);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-6xl space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              SaaS Throughput & ARR Scenario Lab
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl">
              Plug in real funnel data from a past period, compare it
              to editable benchmarks, and see how changes to traffic
              and conversion rates impact ARR run rate. Perfect for
              “where can we move the needle?” conversations.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-xs text-slate-300 max-w-xs">
            <p className="font-medium text-slate-100">
              How to use this
            </p>
            <ol className="mt-1 list-decimal list-inside space-y-1">
              <li>Enter your actuals for any past period.</li>
              <li>Adjust benchmarks and traffic growth.</li>
              <li>Compare baseline vs projected ARR run rate.</li>
            </ol>
          </div>
        </header>

        {/* Layout: Inputs + Benchmarks / Metrics */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* Left column: Baseline inputs */}
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">
                  1. Baseline performance
                </h2>
                <p className="text-xs text-slate-300">
                  Use real data from last quarter, last 12 months, or
                  any period you want to analyse.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">
                    Period label
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    value={inputs.periodLabel}
                    onChange={(e) =>
                      handleInputChange(
                        "periodLabel",
                        e.target.value
                      )
                    }
                    placeholder="Last 12 months"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">
                    Period length (months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    value={inputs.periodMonths}
                    onChange={(e) =>
                      handleInputChange(
                        "periodMonths",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["visitors", "Website visitors"],
                    ["leads", "Leads / signups"],
                    ["mqls", "MQLs"],
                    ["sqls", "SQLs"],
                    ["opps", "Opportunities"],
                    ["wins", "Wins"],
                  ] as [keyof FunnelInputs, string][]
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-slate-300">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      value={inputs[key]}
                      onChange={(e) =>
                        handleInputChange(key, e.target.value)
                      }
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">
                    Average deal size (ASP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    value={inputs.asp}
                    onChange={(e) =>
                      handleInputChange("asp", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Baseline funnel summary */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  Baseline funnel snapshot
                </h2>
                <span className="text-xs text-slate-300">
                  {baseline.periodLabel} • {baseline.periodMonths}{" "}
                  months
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">
                    ARR run rate (baseline)
                  </p>
                  <p className="text-xl font-semibold">
                    {toCurrency(baseline.arrRunRate)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Based on wins and ASP over this period.
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">
                    Wins per month
                  </p>
                  <p className="text-xl font-semibold">
                    {baseline.winsPerMonth.toFixed(1)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Average across the selected period.
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">
                    New ARR in period
                  </p>
                  <p className="text-xl font-semibold">
                    {toCurrency(baseline.newArrInPeriod)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    New business only (excludes expansion/churn).
                  </p>
                </div>
              </div>

              <div className="mt-2 grid gap-3 md:grid-cols-5">
                {baseline.conversionRates.map((r) => (
                  <div
                    key={r.label}
                    className="rounded-lg bg-slate-950/40 border border-slate-800 p-3"
                  >
                    <p className="text-[11px] text-slate-400">
                      {r.label}
                    </p>
                    <p className="text-base font-semibold">
                      {r.value.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right column: Benchmarks + Projection */}
          <section className="space-y-6">
            {/* Benchmarks */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  2. Benchmarks and assumptions
                </h2>
                <button
                  type="button"
                  onClick={() => setShowBenchmarks((s) => !s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-950/60 hover:bg-slate-900 transition"
                >
                  {showBenchmarks ? "Hide" : "Edit"} benchmarks
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Use sensible B2B SaaS benchmarks, then adjust them to
                match your market. You can also model traffic growth
                from new channels or better conversion earlier in the
                funnel.
              </p>

              {showBenchmarks && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["visitorToLead", "Visitor → Lead (%)"],
                        ["leadToMql", "Lead → MQL (%)"],
                        ["mqlToSql", "MQL → SQL (%)"],
                        ["sqlToOpp", "SQL → Opportunity (%)"],
                        ["oppToWin", "Opportunity → Win (%)"],
                      ] as [keyof Benchmarks, string][]
                    ).map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs text-slate-300">
                          {label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          value={benchmarks[key]}
                          onChange={(e) =>
                            handleBenchmarkChange(
                              key,
                              e.target.value
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr] items-end">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">
                        Traffic growth vs baseline (%)
                      </label>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        value={benchmarks.trafficGrowthPercent}
                        onChange={(e) =>
                          handleBenchmarkChange(
                            "trafficGrowthPercent",
                            e.target.value
                          )
                        }
                        placeholder="e.g. 25"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Optional: simulate extra qualified traffic
                        from new channels, SEO, or partner plays.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetBenchmarks}
                      className="text-xs h-9 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-900 transition"
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Projection */}
            <div className="rounded-2xl border border-emerald-600/60 bg-slate-900/90 p-5 space-y-4">
              <h2 className="text-lg font-semibold">
                3. Projection vs baseline
              </h2>
              <p className="text-xs text-slate-200">
                Using your baseline visitors and period length, plus
                benchmark conversion rates and traffic growth, this
                estimates projected wins and ARR run rate.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">
                    Projected ARR run rate
                  </p>
                  <p className="text-xl font-semibold text-emerald-300">
                    {toCurrency(projection.arrRunRate)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    If you hit these benchmarks and assumptions.
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">
                    Lift vs baseline
                  </p>
                  <p className="text-xl font-semibold">
                    {arrLiftAbs >= 0 ? "+" : ""}
                    {toCurrency(arrLiftAbs)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {baseline.arrRunRate > 0 ? (
                      <>
                        {arrLiftPct >= 0 ? "+" : ""}
                        {arrLiftPct.toFixed(1)} percent vs current
                        run rate.
                      </>
                    ) : (
                      "Baseline ARR run rate is zero."
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">
                    Projected wins / month
                  </p>
                  <p className="text-xl font-semibold">
                    {projection.winsPerMonth.toFixed(1)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Based on benchmark funnel and traffic assumptions.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-4">
                  <p className="text-xs font-semibold text-slate-200 mb-1">
                    Baseline vs projected at a glance
                  </p>
                  <ul className="text-[11px] text-slate-300 space-y-1.5">
                    <li>
                      Baseline ARR run rate:{" "}
                      <span className="font-medium">
                        {toCurrency(baseline.arrRunRate)}
                      </span>
                    </li>
                    <li>
                      Projected ARR run rate:{" "}
                      <span className="font-medium">
                        {toCurrency(projection.arrRunRate)}
                      </span>
                    </li>
                    <li>
                      Baseline visitors (period):{" "}
                      <span className="font-medium">
                        {inputs.visitors.toLocaleString()}
                      </span>
                    </li>
                    <li>
                      Projected visitors (with growth):{" "}
                      <span className="font-medium">
                        {Math.round(
                          projection.adjVisitors
                        ).toLocaleString()}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-4">
                  <p className="text-xs font-semibold text-slate-200 mb-1">
                    Bottleneck vs benchmark
                  </p>
                  {bottleneck ? (
                    <p className="text-[11px] text-slate-300">
                      Your biggest gap to benchmark is at{" "}
                      <span className="font-semibold">
                        {bottleneck.stage}
                      </span>
                      , where you are about{" "}
                      <span className="font-semibold">
                        {bottleneck.gap.toFixed(1)} percentage points
                      </span>{" "}
                      below your target. This is likely the highest
                      leverage place to focus experiments.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-300">
                      Your funnel is close to or above the current
                      benchmarks across all stages. You can now:
                      <br />
                      • push on traffic growth, or
                      <br />
                      • tighten qualification and deal size.
                    </p>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Use this view in interviews or strategy sessions: load
                in real data from the last quarter or year, align on
                realistic benchmarks, and then work backwards from the
                projected ARR gap to prioritised plays.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
