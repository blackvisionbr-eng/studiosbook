const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

export function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function toCsv(headers, rows) {
  return [
    headers.map((header) => csvValue(header.label)).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(header.value(row))).join(",")),
  ].join("\n");
}
