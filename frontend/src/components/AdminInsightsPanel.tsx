import { useEffect, useState } from 'react';
import { api } from '../services/api';

const series = [
  { key: 'income', label: 'Income', color: '#387553' },
  { key: 'expenditure', label: 'Materials & work costs', color: '#7aa88a' },
  { key: 'charges', label: 'Other charges', color: '#e8b75b' },
  { key: 'profit', label: 'Profit / loss', color: '#5877a5' }
] as const;

function FinancialChart({ rows, label, maxValue }: { rows: any[]; label: string; maxValue: number }) {
  const [hoveredBar, setHoveredBar] = useState<{ x: number; y: number; text: string } | null>(null);
  const baseline = 195;
  const height = 145;
  const barWidth = 11;
  return (
    <div className="financial-chart-wrap">
      <h3>{label}</h3>
      <svg className="financial-chart" viewBox="0 0 960 260" role="img" aria-label={`${label} monthly income, costs and profit or loss`}>
        {[0, 1, 2, 3].map((grid) => {
          const y = baseline - height * grid / 3;
          return <g key={grid}><line x1="28" x2="946" y1={y} y2={y} stroke="#e9eee9" /><text x="3" y={y + 4} fill="#8b988e" fontSize="9">{grid === 0 ? '0' : `₹${Math.round(maxValue * grid / 3 / 100000) / 10}L`}</text></g>;
        })}
        {rows.map((row, index) => {
          const x = 36 + index * 75;
          return <g key={row.month}>
            <title>{row.label}: {series.map((item) => `${item.label} ₹${Number(row[item.key]).toLocaleString('en-IN')}`).join(', ')}</title>
            {series.map((item, seriesIndex) => {
              const raw = Number(row[item.key]) || 0;
              const barHeight = item.key === 'profit' && raw < 0
                ? Math.max(2, Math.min(25, 25 * Math.abs(raw) / Math.max(1, maxValue * 0.12)))
                : Math.max(raw > 0 ? 2 : 0, height * raw / maxValue);
              const barY = item.key === 'profit' && raw < 0 ? baseline : baseline - barHeight;
              const valueText = raw < 0 ? `−₹${Math.abs(raw).toLocaleString('en-IN')}` : `₹${raw.toLocaleString('en-IN')}`;
              const tooltipX = Math.max(28, Math.min(700, x + seriesIndex * 14 - 54));
              const tooltipY = Math.max(8, Math.min(184, barY - 38));
              return <rect
                key={item.key}
                x={x + seriesIndex * 14}
                y={barY}
                width={barWidth}
                height={barHeight}
                rx="2"
                fill={item.key === 'profit' && raw < 0 ? '#be6c60' : item.color}
                tabIndex={0}
                aria-label={`${row.label}, ${item.label}: ${valueText}`}
                onMouseEnter={() => setHoveredBar({ x: tooltipX, y: tooltipY, text: `${row.label} · ${item.label}: ${valueText}` })}
                onFocus={() => setHoveredBar({ x: tooltipX, y: tooltipY, text: `${row.label} · ${item.label}: ${valueText}` })}
                onMouseLeave={() => setHoveredBar(null)}
                onBlur={() => setHoveredBar(null)}
              ><title>{`${row.label} · ${item.label}: ${valueText}`}</title></rect>;
            })}
            <text x={x + 24} y="242" textAnchor="middle" fill="#77847a" fontSize="9">{row.label.split(' ')[0]}</text>
          </g>;
        })}
        {hoveredBar && <g className="chart-hover-tooltip" pointerEvents="none">
          <rect x={hoveredBar.x} y={hoveredBar.y} width="250" height="30" rx="6" fill="#23382b" />
          <text x={hoveredBar.x + 10} y={hoveredBar.y + 19} fill="#fff" fontSize="11" fontWeight="600">{hoveredBar.text}</text>
        </g>}
      </svg>
      <div className="financial-legend">{series.map((item) => <span key={item.key}><i style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>
    </div>
  );
}

export default function AdminInsightsPanel() {
  const [insights, setInsights] = useState<any>(null);
  const [demandForecast, setDemandForecast] = useState<any>(null);
  const [demandError, setDemandError] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.admin.getInsights().then((result) => setInsights(result.data)).catch((reason: Error) => setError(reason.message));
    api.ai.getDemandForecast().then((result) => setDemandForecast(result.data)).catch((reason: Error) => setDemandError(reason.message));
  }, []);

  if (error) return <section className="panel admin-insights"><h2>Business trends</h2><p className="empty-state">Could not load insights: {error}</p></section>;
  if (!insights) return <section className="panel admin-insights"><p className="empty-state">Loading business trends…</p></section>;

  const historical = insights.financial.history || [];
  const forecast = insights.financial.forecast || [];
  const maxValue = Math.max(1, ...[...historical, ...forecast].flatMap((row) => [row.income, row.expenditure, row.charges, row.profit]));
  const maxComplaints = Math.max(1, ...insights.complaints.monthly.map((item: any) => item.count));
  const modelNames: Record<string, string> = { linear_regression: 'Linear Regression', random_forest: 'Random Forest', training_mean: 'Historical mean (fallback)' };

  return <div className="admin-insights-stack">
    <section className="panel admin-insights">
      <div className="panel-head"><div><h2>Monthly income & profit outlook</h2><p>Previous year overview and the next 12 month estimate.</p></div></div>
      <p className="insights-demo-note">Demo figures for planning only. Income, expenses, charges, profit/loss, and future values are illustrative until accounting records and model files are connected.</p>
      <FinancialChart rows={historical} label="Previous 12 months · demo overview" maxValue={maxValue} />
      <FinancialChart rows={forecast} label="Next 12 months · demo prediction" maxValue={maxValue} />
      <div className="forecast-reasons"><h3>Why each forecast month may rise or fall</h3>{forecast.map((month: any) => <div key={month.month}><b>{month.label}</b><span>{month.explanation}</span></div>)}</div>
    </section>

    <section className="panel admin-insights">
      <div className="panel-head"><div><h2>Material demand forecast · ML prototype</h2><p>Linear Regression and Random Forest selected from chronological validation.</p></div></div>
      <p className="insights-demo-note">Demonstration only: this forecast uses synthetic sample history, not actual stock usage. Review the held-out scores and replace the sample data before using for purchasing.</p>
      {demandError ? <p className="empty-state">The forecast model could not run: {demandError}. Confirm the local ML environment is installed.</p> : !demandForecast ? <p className="empty-state">Running the demand forecast…</p> : <>
        <div className="complaint-insight-grid">
          {demandForecast.reports.map((report: any) => <div className="complaint-rank" key={report.material_id}>
            <span><b>{report.material_id}</b><br />{modelNames[report.selected_model] || report.status}{report.metrics?.validation?.[report.selected_model] ? <small> · validation MAE {report.metrics.validation[report.selected_model].mae}</small> : null}</span>
            <b>{report.status === 'evaluated' ? `${report.validation_rows} validation rows` : `${report.rows} sample rows`}</b>
          </div>)}
        </div>
        <div className="table-wrap"><table><thead><tr><th>MONTH</th><th>MATERIAL</th><th>DEMO DEMAND</th><th>MODEL</th></tr></thead><tbody>
          {demandForecast.predictions.map((prediction: any) => <tr key={`${prediction.material_id}-${prediction.forecast_period}`}><td>{prediction.forecast_period}</td><td>{prediction.material_name}</td><td>{prediction.predicted_quantity} {prediction.unit}</td><td>{modelNames[prediction.model] || prediction.model}</td></tr>)}
        </tbody></table></div>
      </>}
    </section>

    <section className="panel admin-insights">
      <div className="panel-head"><div><h2>Customer complaint trends</h2><p>{insights.complaints.total} complaint(s) found in the current records.</p></div></div>
      <div className="complaint-insight-grid">
        <div><h3>Complaints by month</h3>{insights.complaints.monthly.map((month: any) => <div className="complaint-month" key={month.month}><span>{month.label}</span><div><i style={{ width: `${month.count ? Math.max(4, month.count / maxComplaints * 100) : 0}%` }} /></div><b>{month.count}</b></div>)}</div>
        <div><h3>Where issues are reported</h3>{insights.complaints.areas.length ? insights.complaints.areas.map((area: any) => <div className="complaint-rank" key={area.name}><span>{area.name}</span><b>{area.count}</b></div>) : <p className="empty-state small">No complaint locations yet.</p>}</div>
        <div><h3>Common concerns</h3>{insights.complaints.problems.length ? insights.complaints.problems.map((problem: any) => <div className="complaint-rank" key={problem.name}><span>{problem.name}</span><b>{problem.count}</b></div>) : <p className="empty-state small">No complaint categories yet.</p>}</div>
      </div>
      <p className="insights-demo-note">Complaint counts and locations come from customer requests currently saved in the app. Add more customer accounts and requests to make this view more useful.</p>
    </section>
  </div>;
}
