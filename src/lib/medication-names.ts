import { normalizeSearch } from "@/lib/catalog-search";

export function normalizeMedicationNames(values: string[], mainName: string): string[] {
  const seen = new Set([normalizeSearch(mainName)]);
  return values.flatMap((value) => value.split(/[,;\n]+/)).map((value) => value.trim().replace(/\s+/g, " ")).filter((value) => {
    const normalized = normalizeSearch(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function medicationNamesError(names: string[]): string | null {
  return names.length > 20 || names.some((name) => name.length > 80) || names.join("\n").length > 1000
    ? "Cadastre até 20 nomes comerciais, com até 80 caracteres cada e 1.000 caracteres no total."
    : null;
}
