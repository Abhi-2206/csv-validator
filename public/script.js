const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("csvFile");
const analyzeButton = document.getElementById("analyzeButton");
const selectedFile = document.getElementById("selectedFile");
const message = document.getElementById("message");
const results = document.getElementById("results");
const previewHead = document.getElementById("previewHead");
const previewBody = document.getElementById("previewBody");
const previewNote = document.getElementById("previewNote");
const emptyPreview = document.getElementById("emptyPreview");
const statusCard = document.getElementById("statusCard");
const statusText = document.getElementById("statusText");

fileInput.addEventListener("change", () => {
  selectedFile.textContent = fileInput.files[0]
    ? `Selected: ${fileInput.files[0].name}`
    : "";
});

function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = `message ${type}`;
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
  message.textContent = "";
}

function setSummaryValue(id, value) {
  document.getElementById(id).textContent = String(value);
}

function renderResults(data) {
  const summary = data.summary;

  setSummaryValue("totalRows", summary.totalRows);
  setSummaryValue("totalColumns", summary.totalColumns);
  setSummaryValue("emptyCells", summary.emptyCells);
  setSummaryValue("duplicateRows", summary.duplicateRows);
  setSummaryValue("inconsistentRows", summary.inconsistentRows);

  statusText.textContent = summary.status;
  statusCard.className = `summary-card status-card ${
    summary.status === "Valid" ? "valid" : "issues"
  }`;

  previewHead.innerHTML = "";
  const headerRow = document.createElement("tr");

  data.columns.forEach((column) => {
    const headerCell = document.createElement("th");
    headerCell.textContent = column;
    headerRow.appendChild(headerCell);
  });

  previewHead.appendChild(headerRow);

  previewBody.innerHTML = "";

  if (data.preview.length === 0) {
    emptyPreview.hidden = false;
    previewNote.textContent = "No data rows found.";
    results.hidden = false;
    return;
  }

  emptyPreview.hidden = true;
  previewNote.textContent =
    summary.totalRows > data.preview.length
      ? `Showing the first ${data.preview.length} of ${summary.totalRows} rows.`
      : `Showing ${data.preview.length} row${data.preview.length === 1 ? "" : "s"}.`;

  data.preview.forEach((row) => {
    const bodyRow = document.createElement("tr");

    data.columns.forEach((column) => {
      const cell = document.createElement("td");
      cell.textContent = row[column] ?? "";
      bodyRow.appendChild(cell);
    });

    previewBody.appendChild(bodyRow);
  });

  results.hidden = false;
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files[0];

  if (!file) {
    showMessage("Please choose a CSV file before analyzing.", "error");
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    showMessage("Only files with a .csv extension are allowed.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("csvFile", file);

  analyzeButton.disabled = true;
  analyzeButton.textContent = "Analyzing...";
  hideMessage();
  results.hidden = true;

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to analyze this CSV file.");
    }

    renderResults(data);
    showMessage(`Analysis complete for ${data.fileName}.`, "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Analyze CSV";
  }
});
