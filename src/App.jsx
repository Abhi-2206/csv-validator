import { useState } from "react";

function SummaryCard({ label, value }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function StatusCard({ status }) {
  return (
    <article className={`summary-card status-card ${status === "Valid" ? "valid" : "issues"}`}>
      <span>Status</span>
      <strong>{status}</strong>
    </article>
  );
}

function PreviewTable({ columns, preview, totalRows }) {
  const previewCount = preview.length;
  const note =
    previewCount === 0
      ? "No data rows found."
      : totalRows > previewCount
        ? `Showing the first ${previewCount} of ${totalRows} rows.`
        : `Showing ${previewCount} row${previewCount === 1 ? "" : "s"}.`;

  return (
    <div className="preview-section">
      <div className="preview-heading">
        <h2>CSV preview</h2>
        <p>{note}</p>
      </div>
      <div className="table-wrapper">
        {columns.length > 0 && (
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column}>{row[column] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {previewCount === 0 && (
          <p className="empty-preview">
            This CSV does not contain any data rows to preview.
          </p>
        )}
      </div>
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [results, setResults] = useState(null);

  function handleFileChange(event) {
    setFile(event.target.files[0] || null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setMessage({ text: "Please choose a CSV file before analyzing.", type: "error" });
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage({ text: "Only files with a .csv extension are allowed.", type: "error" });
      return;
    }

    const formData = new FormData();
    formData.append("csvFile", file);

    setLoading(true);
    setMessage({ text: "", type: "info" });
    setResults(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to analyze this CSV file.");
      }

      setResults(data);
      setMessage({ text: `Analysis complete for ${data.fileName}.`, type: "success" });
    } catch (error) {
      setMessage({ text: error.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">CSV Check</p>
        <h1>CSV Validator</h1>
        <p className="description">
          Upload a CSV file to parse it, detect data issues, and preview the first records.
        </p>
      </header>

      <section className="card upload-card">
        <h2>Analyze a CSV file</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="csvFile">CSV file</label>
          <input
            id="csvFile"
            name="csvFile"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            required
          />
          <div className="actions">
            <button type="submit" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze CSV"}
            </button>
            <span className="selected-file">
              {file ? `Selected: ${file.name}` : ""}
            </span>
          </div>
        </form>
        {message.text && (
          <div className={`message ${message.type}`} role="alert">
            {message.text}
          </div>
        )}
      </section>

      {results && (
        <section className="results">
          <h2>Validation summary</h2>
          <div className="summary-grid">
            <SummaryCard label="Total rows" value={results.summary.totalRows} />
            <SummaryCard label="Total columns" value={results.summary.totalColumns} />
            <SummaryCard label="Empty cells" value={results.summary.emptyCells} />
            <SummaryCard label="Duplicate rows" value={results.summary.duplicateRows} />
            <SummaryCard label="Inconsistent rows" value={results.summary.inconsistentRows} />
            <StatusCard status={results.summary.status} />
          </div>

          <PreviewTable
            columns={results.columns}
            preview={results.preview}
            totalRows={results.summary.totalRows}
          />
        </section>
      )}
    </main>
  );
}

export default App;
