import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Exercise the actual TS helpers using the existing compiler, with no test dependency.
const modules = new Map();
function loadSource(name) {
  if (modules.has(name)) return modules.get(name);
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const result = { exports: {} };
  const factory = runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);
  factory((specifier) => {
    assert.ok(specifier.startsWith("@/lib/"));
    return loadSource(specifier.slice("@/lib/".length));
  }, result, result.exports);
  modules.set(name, result.exports);
  return result.exports;
}

const { parseCatalogForm } = loadSource("catalog-validation");
const { dosageComponents, dosageLabel, medicationTitle, periodLabel, posologyLabel, routeLabel } = loadSource("medications");
const { formatQuantity, isCountUnit, unitLabel } = loadSource("units");
const { matchesCatalogSearch } = loadSource("catalog-search");

function medicationForm(overrides = {}) {
  const data = new FormData();
  const fields = {
    name: "Medicamento de teste", kind: "medicamento", unit: "unidade",
    posologyType: "daily", timesPerDay: "2", doseTimes: ["08:00", "20:00"], posologyNotes: "Orientação informada",
    administrationRoute: "oral", periodType: "indefinite", dosageAmount: "500", dosageUnit: "mg",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  }
  return data;
}

function parsedMedication(fields) {
  const parsed = parseCatalogForm(medicationForm(fields));
  assert.ok("data" in parsed, JSON.stringify(parsed));
  return parsed.data.medication;
}

test("ordinary items retain the original units and need no medication metadata", () => {
  for (const unit of ["unidade", "ml", "kg"]) {
    const form = new FormData();
    form.set("name", "  Alcool em gel  ");
    form.set("unit", unit);
    assert.deepEqual(parseCatalogForm(form), { data: { name: "Alcool em gel", kind: "item", unit, medication: null } });
  }
});

test("daily medication dosage is independent of stock unit", () => {
  const medication = parsedMedication();
  assert.deepEqual(medication.posology, { type: "daily", timesPerDay: 2, times: ["08:00", "20:00"], notes: "Orientação informada" });
  assert.equal(posologyLabel(medication), "2 vezes ao dia · Horários: 08:00, 20:00 · Orientação informada");
  assert.deepEqual(medication.period, { type: "indefinite" });
  assert.deepEqual(medication.dosage, { components: [{ amount: 500, unit: "mg" }] });
  assert.equal(dosageLabel(medication), "500 mg");
  assert.equal(routeLabel(medication), "Oral");
});

test("weekday schedules preserve and deduplicate the selected days", () => {
  const medication = parsedMedication({ posologyType: "weekly", daysOfWeek: ["1", "3", "0", "1"], timesPerDay: "1", doseTimes: ["09:30"], posologyNotes: "" });
  assert.deepEqual(medication.posology.daysOfWeek, [1, 3, 0]);
  assert.equal(posologyLabel(medication), "1 vez ao dia · Seg, Qua, Dom · Horários: 09:30");
});

test("each daily or weekly dose needs one valid time in 24-hour format", () => {
  for (const posologyType of ["daily", "weekly"]) {
    const fields = { posologyType, daysOfWeek: ["1", "5"] };
    for (const doseTimes of [[], ["08:00"], ["08:00", "20:00", "22:00"], ["", "20:00"], ["24:00", "20:00"], ["08:60", "20:00"], ["8:00", "20:00"], ["08:00:30", "20:00"], ["morning", "20:00"]]) {
      assert.ok("error" in parseCatalogForm(medicationForm({ ...fields, doseTimes })), JSON.stringify({ posologyType, doseTimes }));
    }
    const medication = parsedMedication({ ...fields, timesPerDay: "3", doseTimes: ["00:00", "12:15", "23:59"] });
    assert.deepEqual(medication.posology.times, ["00:00", "12:15", "23:59"]);
  }
});

test("legacy schedules stay readable without inventing medication times", () => {
  const medication = parsedMedication({ posologyNotes: "Notas existentes" });
  delete medication.posology.times;
  assert.equal(posologyLabel(medication), "2 vezes ao dia · Notas existentes");
  medication.posology = { type: "weekly", timesPerDay: 1, daysOfWeek: [1, 5], notes: "" };
  assert.equal(posologyLabel(medication), "1 vez ao dia · Seg, Sex");
});

test("free posology, custom route, custom dosage and date period round-trip", () => {
  const medication = parsedMedication({
    posologyType: "free", posologyInstructions: "  Orientação livre\nSegunda linha  ",
    administrationRoute: "outra", customRoute: "Via informada",
    periodType: "range", startDate: "2028-02-29", endDate: "2028-03-15",
    dosageAmount: "0,125", dosageUnit: "outra", customDosageUnit: "mg/dose",
  });
  assert.equal(posologyLabel(medication), "Orientação livre\nSegunda linha");
  assert.equal(routeLabel(medication), "Via informada");
  assert.equal(periodLabel(medication), "29/02/2028 a 15/03/2028");
  assert.equal(dosageLabel(medication), "0,125 mg/dose");
  assert.deepEqual(medication.posology, { type: "free", instructions: "Orientação livre\nSegunda linha" });
});

test("required medication fields, invalid kinds and type-specific stock units are rejected", () => {
  const invalid = [
    { name: "x" }, { name: "x".repeat(81) }, { kind: "other" }, { unit: "kg" },
    { kind: "item", unit: "mg" }, { posologyType: "unknown" }, { timesPerDay: "" },
    { timesPerDay: "1.5" }, { timesPerDay: "0" }, { timesPerDay: "100" },
    { posologyType: "weekly" }, { posologyType: "weekly", daysOfWeek: ["7"] },
    { posologyType: "weekly", daysOfWeek: [""] }, { posologyType: "free", posologyInstructions: " " },
    { posologyNotes: "x".repeat(1001) }, { administrationRoute: "invalid" },
    { administrationRoute: "outra", customRoute: "" }, { periodType: "unknown" },
    { dosageAmount: "0" }, { dosageAmount: "-1" }, { dosageAmount: "NaN" },
    { dosageAmount: "Infinity" }, { dosageAmount: "0.0001" }, { dosageUnit: "unknown" },
    { dosageUnit: "outra", customDosageUnit: "" },
  ];
  for (const fields of invalid) assert.ok("error" in parseCatalogForm(medicationForm(fields)), JSON.stringify(fields));
});

test("period validation rejects missing, impossible and reversed dates", () => {
  for (const [startDate, endDate] of [["", ""], ["2026-02-29", "2026-03-01"], ["2026-13-01", "2027-01-01"], ["2026-10-06", "2026-10-05"], ["0000-01-01", "2026-01-01"]]) {
    assert.ok("error" in parseCatalogForm(medicationForm({ periodType: "range", startDate, endDate })));
  }
  assert.deepEqual(parsedMedication({ periodType: "range", startDate: "2026-10-05", endDate: "2026-10-05" }).period, { type: "range", startDate: "2026-10-05", endDate: "2026-10-05" });
});

test("medication stock units and labels work without converting historical quantities", () => {
  for (const unit of ["unidade", "ml", "mg", "g", "gotas"]) assert.ok("data" in parseCatalogForm(medicationForm({ unit })));
  assert.equal(unitLabel("mg", "long"), "miligramas");
  assert.equal(unitLabel("g", "long"), "gramas");
  assert.equal(unitLabel("gotas", "long"), "gotas");
  assert.equal(isCountUnit("gotas"), true);
  assert.equal(isCountUnit("ml"), false);
  assert.equal(formatQuantity(0.4, "unidade"), "0,4");
  assert.equal(formatQuantity(400, "ml"), "400");
});

test("stock quantity per dose is optional, independent of strength and supports partial units", () => {
  assert.equal(parsedMedication().stockPerDose, undefined);
  for (const value of ["1", "2", "0.5", "0,125", "999999999"]) {
    const medication = parsedMedication({ stockPerDose: value });
    assert.equal(medication.stockPerDose, Number(value.replace(",", ".")));
    assert.deepEqual(medication.dosage, { components: [{ amount: 500, unit: "mg" }] });
  }
  for (const stockPerDose of ["0", "-1", "NaN", "Infinity", "0.0001", "1000000000"]) {
    assert.ok("error" in parseCatalogForm(medicationForm({ stockPerDose })), stockPerDose);
  }
});

test("other medication names are optional and preserve distinct names without case or accent duplicates", () => {
  assert.deepEqual(parsedMedication().otherNames, []);
  assert.deepEqual(parsedMedication({
    name: "Ondansetrona", otherNames: " Vonau   Flash, VONAU FLASH;\n ondansétrona, , Cloridrato de ondansetrona ",
  }).otherNames, ["Vonau Flash", "Cloridrato de ondansetrona"]);
  for (const otherNames of ["x".repeat(81), Array.from({ length: 21 }, (_, i) => `Marca ${i}`).join(","), "a,".repeat(501)]) {
    assert.ok("error" in parseCatalogForm(medicationForm({ otherNames })));
  }
});

test("catalog search finds main and alternate names without accents and keeps presentations distinct", () => {
  const item = { name: "Ondansetrona", medication: parsedMedication({ otherNames: "Vonau Flash", dosageAmount: "4" }) };
  const otherPresentation = { ...item, medication: { ...item.medication, dosage: { amount: 8, unit: "mg" } } };
  for (const query of ["ondansetrona", "  VÓNAU  ", "Vonau   Flash", ""]) assert.equal(matchesCatalogSearch(item, query), true);
  assert.equal(matchesCatalogSearch(item, "Novalgina"), false);
  assert.equal(matchesCatalogSearch({ name: "Lenço umedecido", medication: null }, "lenco"), true);
  assert.equal(matchesCatalogSearch({ name: "Medicamento antigo", medication: { ...item.medication, otherNames: undefined } }, "Vonau"), false);
  const matches = [item, otherPresentation].filter((record) => matchesCatalogSearch(record, "Vonau"));
  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((record) => dosageLabel(record.medication)), ["4 mg", "8 mg"]);
});

test("commercial names added individually and the current draft are saved together without duplicate ingredients", () => {
  const medication = parsedMedication({ name: "Ondansetrona", otherNames: ["Vonau Flash", "VONAU FLASH", "Ondansétrona", "Outra marca", ""] });
  assert.deepEqual(medication.otherNames, ["Vonau Flash", "Outra marca"]);
  assert.deepEqual(parsedMedication({ otherNames: ["", " "] }).otherNames, []);
  assert.deepEqual(medication.dosage, { components: [{ amount: 500, unit: "mg" }] });
});

test("medication headings identify the ingredient and strength while ordinary item headings stay unchanged", () => {
  assert.equal(medicationTitle("Ondansetrona", parsedMedication({ dosageAmount: "4" })), "Ondansetrona 4 mg");
  assert.equal(medicationTitle("Ondansetrona", parsedMedication({ dosageAmount: "8" })), "Ondansetrona 8 mg");
  assert.equal(medicationTitle("Sabonete", null), "Sabonete");
});

const combinationFields = {
  name: "Sulfametoxazol + trimetoprim",
  dosageIngredient: [" Sulfametoxazol ", "Trimetoprim"],
  dosageAmount: ["400", "80"], dosageUnit: ["mg", "mg"], customDosageUnit: ["", ""],
  timesPerDay: "1", doseTimes: ["08:00"], stockPerDose: "1",
};

test("combination strengths preserve ingredient order and round-trip without summing amounts", () => {
  const medication = parsedMedication(combinationFields);
  assert.deepEqual(medication.dosage, { components: [
    { ingredient: "Sulfametoxazol", amount: 400, unit: "mg" },
    { ingredient: "Trimetoprim", amount: 80, unit: "mg" },
  ] });
  assert.equal(dosageLabel(medication), "400 mg + 80 mg");
  assert.equal(dosageLabel(medication, true), "Sulfametoxazol: 400 mg + Trimetoprim: 80 mg");
  assert.equal(medicationTitle(combinationFields.name, medication), "Sulfametoxazol + trimetoprim 400 mg + 80 mg");
  assert.equal(medication.stockPerDose, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(medication)), medication);
  assert.equal(matchesCatalogSearch({ name: "Associação", medication }, "TRIMETÓPRIM"), true);
});

test("components support independent units, decimal amounts and aligned custom units", () => {
  const medication = parsedMedication({
    ...combinationFields, dosageIngredient: ["Ingrediente A", "Ingrediente B", "Ingrediente C"],
    dosageAmount: ["0,125", "25", "5"], dosageUnit: ["mg", "mcg", "outra"], customDosageUnit: ["", "", " UI/dose "],
  });
  assert.equal(dosageLabel(medication), "0,125 mg + 25 mcg + 5 UI/dose");
  assert.equal(medication.dosage.components[2].unit, "UI/dose");
});

test("every component must be complete and within limits, including malformed array submissions", () => {
  const invalid = [
    { dosageAmount: [] }, { dosageAmount: ["400", ""] }, { dosageAmount: ["400", "0"] },
    { dosageAmount: ["400", "NaN"] }, { dosageAmount: ["400", "Infinity"] },
    { dosageAmount: ["400", "-1"] }, { dosageAmount: ["400", "0.0001"] },
    { dosageAmount: ["400", "0.00000001"] }, { dosageAmount: ["400", "1000000000"] },
    { dosageAmount: ["400", "1.0000000001"] },
    { dosageIngredient: ["", "Trimetoprim"] }, { dosageIngredient: ["A", " "] },
    { dosageIngredient: ["A", "x".repeat(81)] }, { dosageIngredient: ["A"] },
    { dosageUnit: ["mg"] }, { dosageUnit: ["mg", "unknown"] },
    { dosageUnit: ["mg", "outra"], customDosageUnit: ["", ""] },
    { dosageUnit: ["mg", "outra"], customDosageUnit: ["", "x".repeat(33)] },
    { customDosageUnit: [""] }, { customDosageUnit: ["", "", ""] },
    { dosageAmount: Array(11).fill("1"), dosageIngredient: Array(11).fill("A"), dosageUnit: Array(11).fill("mg"), customDosageUnit: Array(11).fill("") },
  ];
  for (const fields of invalid) {
    assert.ok("error" in parseCatalogForm(medicationForm({ ...combinationFields, ...fields })), JSON.stringify(fields));
  }
  assert.ok("data" in parseCatalogForm(medicationForm({
    dosageAmount: Array(10).fill("1"), dosageIngredient: Array(10).fill("A"), dosageUnit: Array(10).fill("mg"), customDosageUnit: Array(10).fill(""),
  })));
});

test("legacy dosage stays readable and can be edited into a single-component record", () => {
  const medication = { ...parsedMedication(), dosage: { amount: 0.125, unit: "mg/dose" } };
  assert.deepEqual(dosageComponents(medication), [{ amount: 0.125, unit: "mg/dose" }]);
  assert.equal(dosageLabel(medication), "0,125 mg/dose");
  const edited = parsedMedication({ dosageIngredient: "", dosageAmount: "0.125", dosageUnit: "outra", customDosageUnit: "mg/dose" });
  assert.deepEqual(edited.dosage, { components: [{ amount: 0.125, unit: "mg/dose" }] });
  assert.equal(dosageLabel(edited), dosageLabel(medication));
});
