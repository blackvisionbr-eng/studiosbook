import assert from "node:assert/strict";
import test from "node:test";
import { csvValue, toCsv } from "../src/lib/csv.js";

test("escapes quotes in CSV fields", () => {
  assert.equal(csvValue('Cliente "VIP"'), '"Cliente ""VIP"""');
});

test("neutralizes spreadsheet formulas from user-controlled values", () => {
  for (const value of ["=1+1", "+SUM(A1:A2)", "-10+20", "@IMPORTDATA(A1)", "  =HYPERLINK(A1)"]) {
    assert.equal(csvValue(value).startsWith('"\''), true);
  }
});

test("builds rows with neutralized user data", () => {
  const output = toCsv(
    [{ label: "Nome", value: (row) => row.name }],
    [{ name: "=cmd|' /C calc'!A0" }]
  );
  assert.match(output, /"'=cmd/);
});
