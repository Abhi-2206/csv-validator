const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser-node");

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== ".csv") {
      const error = new Error("Only .csv files are allowed.");
      error.status = 400;
      return callback(error, false);
    }

    callback(null, true);
  }
});

app.use(express.static(path.join(__dirname, "dist")));

function isEmptyCell(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  return value;
}

function collectColumns(records) {
  const columns = [];
  const seen = new Set();

  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (key === "_extra" || seen.has(key)) {
        continue;
      }

      seen.add(key);
      columns.push(key);
    }
  }

  return columns;
}

async function getHeaderColumns(filePath) {
  const content = await fs.readFile(filePath, "utf8");

  if (!content.trim()) {
    return [];
  }

  const separator = content.endsWith("\n") ? "" : "\n";
  const probeValue = "__csv_check_header_probe__";
  const parsed = csvParser.parse(`${content}${separator}${probeValue}`);
  const probeRow = parsed.find((row) => Object.values(row).includes(probeValue));

  if (!probeRow) {
    return [];
  }

  return Object.keys(probeRow).filter((key) => key !== "_extra");
}

function validateRecords(records, columns) {
  let emptyCells = 0;
  let duplicateRows = 0;
  let inconsistentRows = 0;
  const rowCounts = new Map();

  for (const record of records) {
    if (Array.isArray(record._extra) && record._extra.length > 0) {
      inconsistentRows += 1;
    }

    for (const column of columns) {
      if (isEmptyCell(record[column])) {
        emptyCells += 1;
      }
    }

    const signature = JSON.stringify(canonicalize(record));
    const count = rowCounts.get(signature) || 0;

    if (count > 0) {
      duplicateRows += 1;
    }

    rowCounts.set(signature, count + 1);
  }

  const hasIssues = emptyCells > 0 || duplicateRows > 0 || inconsistentRows > 0;

  return {
    totalRows: records.length,
    totalColumns: columns.length,
    emptyCells,
    duplicateRows,
    inconsistentRows,
    status: hasIssues ? "Issues Found" : "Valid"
  };
}

app.post("/api/analyze", upload.single("csvFile"), async (req, res, next) => {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res.status(400).json({
      success: false,
      message: "Please choose a CSV file to analyze."
    });
  }

  try {
    let records;

    try {
      records = await csvParser(uploadedFile.path);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: `CSV parsing failed: ${parseError.message}`
      });
    }

    if (!Array.isArray(records)) {
      throw new Error("csv-parser-node returned an unexpected result.");
    }

    let columns = collectColumns(records);

    if (records.length === 0) {
      columns = await getHeaderColumns(uploadedFile.path);
    }

    const validation = validateRecords(records, columns);

    res.json({
      success: true,
      fileName: uploadedFile.originalname,
      summary: validation,
      columns,
      preview: records.slice(0, 10)
    });
  } catch (error) {
    next(error);
  } finally {
    if (uploadedFile) {
      await fs.unlink(uploadedFile.path).catch(() => {});
    }
  }
});

app.use((error, req, res, next) => {
  if (req.file && req.file.path) {
    fs.unlink(req.file.path).catch(() => {});
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "The uploaded file is too large. Please choose a file under 10 MB."
        : `Upload failed: ${error.message}`;

    return res.status(status).json({ success: false, message });
  }

  const status = error.status || 500;
  const message = status === 500 ? "Unexpected server error." : error.message;

  res.status(status).json({ success: false, message });
});

app.listen(PORT, () => {
  console.log(`CSV Check is running at http://localhost:${PORT}`);
});

module.exports = app;
