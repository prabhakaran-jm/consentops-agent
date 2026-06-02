export default function Home() {
  const sections = [
    "Deletion request",
    "Data spread map",
    "Cleanup plan",
    "Audit report",
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-14 sm:px-10">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            ConsentOps Agent
          </h1>
          <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
            Trace personal data across pipelines, approve cleanup, and generate
            audit proof.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {sections.map((section, index) => (
            <article
              key={section}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Step {index + 1}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {section}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Placeholder content for this stage of the hackathon demo.
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
