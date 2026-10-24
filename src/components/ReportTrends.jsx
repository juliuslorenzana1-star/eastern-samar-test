import { monthlyTrends } from '../lib/analytics.js';

export default function ReportTrends({ reports }) {
  const periods = monthlyTrends(reports);
  const max = Math.max(1, ...periods.flatMap((period) => [period.submitted, period.resolved]));
  const distribution=Object.entries(reports.reduce((counts,report)=>({...counts,[report.category_slug]:(counts[report.category_slug]||0)+1}),{}));
  return <details className="civic-guide report-trends"><summary>Monthly reporting and resolution trends</summary><p>Six calendar months, UTC. Published reports loaded in this session; current filters apply.</p><table><caption>Report trends</caption><thead><tr><th scope="col">Month</th><th scope="col">Submitted</th><th scope="col">Resolved</th></tr></thead><tbody>{periods.map((period) => <tr key={period.month}><th scope="row">{period.month}</th><td><meter min="0" max={max} value={period.submitted} aria-label={`${period.month} submissions`} /> {period.submitted}</td><td><meter min="0" max={max} value={period.resolved} aria-label={`${period.month} resolutions`} /> {period.resolved}</td></tr>)}</tbody></table><h3>Reports by category</h3>{distribution.length ? distribution.map(([name,count])=><p key={name}>{name.replaceAll('-',' ')} <meter min="0" max={Math.max(reports.length,1)} value={count} aria-label={`${name} reports`} /> {count}</p>) : <p>No published reports in this view.</p>}</details>;
}
