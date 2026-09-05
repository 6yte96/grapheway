import { PROJECT_CONFIG } from "@/config";

export function Benchmarks() {
  const { benchmarks } = PROJECT_CONFIG;

  return (
    <section id="benchmarks" className="projects-section" style={{ paddingTop: "1rem" }}>
      <div className="section-header">
        <div className="section-header-left">
          <h2 className="section-title">{benchmarks.title}</h2>
          <p className="section-description">{benchmarks.subtitle}</p>
        </div>
      </div>

      <div className="benchmark-table-wrapper">
        <table className="benchmark-table">
          <thead>
            <tr>
              {benchmarks.headers.map((header, idx) => (
                <th key={idx}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benchmarks.rows.map((row, idx) => (
              <tr
                key={idx}
                className={row.highlight ? "highlight-row" : ""}
              >
                <td>
                  <strong>{row.name}</strong>
                  {row.isTarget && (
                    <span className="benchmark-badge-best">LEADING</span>
                  )}
                </td>
                {row.metrics.map((metric, mIdx) => (
                  <td key={mIdx}>{metric}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: "0.75rem",
        }}
        className="font-mono text-xs text-muted-foreground"
      >
        <span className="telemetry-pill">
          <span style={{ color: "#10b981" }}>●</span>
          <span>Probe Verified</span>
        </span>
      </div>
    </section>
  );
}
