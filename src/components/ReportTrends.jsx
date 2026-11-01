import { t } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { monthlyTrends } from '../lib/analytics.js';
import { categoryLabel } from '../lib/categories.js';

export default function ReportTrends({ reports }) {
  useTranslation();
  const periods = monthlyTrends(reports);
  const max = Math.max(1, ...periods.flatMap((period) => [period.submitted, period.resolved]));
  const distribution=Object.entries(reports.reduce((counts,report)=>({...counts,[report.category_slug]:(counts[report.category_slug]||0)+1}),{}));
  return <details className="civic-guide report-trends"><summary>{t("Monthly reporting and resolution trends")}</summary><p>{t("Six calendar months, UTC. Published reports loaded in this session; current filters apply.")}</p><table><caption>{t("Report trends")}</caption><thead><tr><th scope="col">{t("Month")}</th><th scope="col">{t("Submitted")}</th><th scope="col">{t("Resolved")}</th></tr></thead><tbody>{periods.map((period) => <tr key={period.month}><th scope="row">{period.month}</th><td><meter min="0" max={max} value={period.submitted} aria-label={t("{{value1}} submissions", { value1: period.month })} /> {period.submitted}</td><td><meter min="0" max={max} value={period.resolved} aria-label={t("{{value1}} resolutions", { value1: period.month })} /> {period.resolved}</td></tr>)}</tbody></table><h3>{t("Reports by category")}</h3>{distribution.length ? distribution.map(([name,count])=><p key={name}>{t(categoryLabel(name))} <meter min="0" max={Math.max(reports.length,1)} value={count} aria-label={t("{{value1}} reports", { value1: name })} /> {count}</p>) : <p>{t("No published reports in this view.")}</p>}</details>;
}
