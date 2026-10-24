export function monthlyTrends(reports, now = new Date()) {
  const periods = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    return { month: date.toISOString().slice(0, 7), submitted: 0, resolved: 0 };
  });
  const byMonth = new Map(periods.map((period) => [period.month, period]));
  for (const report of reports) {
    const submission = byMonth.get(report.created_at?.slice(0, 7));
    if (submission) submission.submitted++;
    const resolution = report.status === 'resolved' && byMonth.get(report.resolved_at?.slice(0, 7));
    if (resolution) resolution.resolved++;
  }
  return periods;
}
