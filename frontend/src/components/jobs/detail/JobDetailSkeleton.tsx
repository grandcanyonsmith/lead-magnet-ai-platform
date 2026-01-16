export function JobDetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-9 w-40 rounded-lg bg-gray-200 dark:bg-gray-800" />

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-80 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="h-6 w-24 rounded-full bg-gray-100 dark:bg-gray-800" />
          <div className="h-6 w-36 rounded-full bg-gray-100 dark:bg-gray-800" />
          <div className="h-6 w-28 rounded-full bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="mt-3 h-3 w-52 rounded bg-gray-100 dark:bg-gray-800" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3 w-32 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-10 w-10 rounded-2xl bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="mt-4 h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex gap-6 border-b border-gray-100 dark:border-gray-800 pb-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
        <div className="mt-6 h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}
