import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("Supabase reads bypass the duplicate fetch cache while preserving request and auth options", async () => {
  const source = readFileSync(new URL("../src/lib/supabase.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const calls = [];
  const response = { status: 200 };
  const result = { exports: {} };
  runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key" } },
    fetch: async (input, options) => { calls.push({ input, options }); return response; },
  })((specifier) => {
    assert.equal(specifier, "@supabase/supabase-js");
    return { createClient: (_url, _key, options) => ({ options }) };
  }, result, result.exports);
  const client = result.exports.getSupabase();
  assert.equal(client.options.auth.persistSession, false);
  assert.equal(client.options.auth.autoRefreshToken, false);
  const headers = { "x-test": "preserved" };
  const signal = new AbortController().signal;
  assert.equal(await client.options.global.fetch("https://example.supabase.co/rest/v1/items", { method: "GET", headers, signal, cache: "force-cache" }), response);
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers, headers);
  assert.equal(calls[0].options.signal, signal);
});
