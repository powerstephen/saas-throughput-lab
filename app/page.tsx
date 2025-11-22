import ThroughputCalculator from "@/components/ThroughputCalculator";

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="max-w-5xl mx-auto px-4 pt-10 pb-6 space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          SaaS Throughput Lab
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold">
          Model your SaaS funnel and find the real bottlenecks
        </h1>
        <p className="text-sm md:text-base text-slate-300 max-w-2xl">
          Adjust conversion, velocity and channel mix to see how changes in your
          funnel translate into pipeline and projected ARR. Use it in leadership
          conversations to show where marketing and sales can unlock the most
          impact.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-16">
        <ThroughputCalculator />
      </section>
    </main>
  );
}
