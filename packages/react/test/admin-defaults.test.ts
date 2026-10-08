// Neutral locale defaults: no time zone, currency or phone country is assumed unless the host sets one.
import test from "node:test";
import assert from "node:assert/strict";
import { resolveAdminDefaults, runtimeTimeZone, utcOffsetOf } from "../src/admin-defaults.ts";
import { formatMinorMoney } from "../src/format.ts";
import { currencySymbol, defaultPhoneCountry, MONEY_CURRENCIES, PHONE_COUNTRIES } from "../src/number-input-core.ts";
import { FORM_COUNTRY_CODES } from "../src/form-builder/form-core.ts";

const sorted = (list: readonly string[]) => [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

test("resolveAdminDefaults: runtime zone, no currency, phone country from the locale; host values win", () => {
  assert.deepEqual(resolveAdminDefaults({}), { timeZone: runtimeTimeZone(), currency: "", phoneCountry: "" });
  assert.equal(runtimeTimeZone(), new Intl.DateTimeFormat().resolvedOptions().timeZone);
  assert.deepEqual(resolveAdminDefaults({ timeZone: "Asia/Tokyo", currency: "JPY", phoneCountry: "+81" }), { timeZone: "Asia/Tokyo", currency: "JPY", phoneCountry: "+81" });
});

test("utcOffsetOf: whole and half-hour offsets, UTC", () => {
  assert.equal(utcOffsetOf("Asia/Shanghai"), "+08:00");
  assert.equal(utcOffsetOf("Asia/Kolkata"), "+05:30");
  assert.equal(utcOffsetOf("UTC"), "+00:00");
});

test("money: no symbol unless one is given; currencySymbol reads ISO codes and plain symbols", () => {
  assert.equal(formatMinorMoney(123456n), "1,234.56");
  assert.equal(formatMinorMoney(-5n), "−0.05");
  assert.equal(currencySymbol("USD"), "US$");
  assert.equal(currencySymbol("¥"), "¥");
  assert.equal(currencySymbol(""), "");
  assert.equal(currencySymbol(undefined), "");
  const codes = MONEY_CURRENCIES.map((c) => c.code);
  assert.deepEqual(codes, sorted(codes), "currencies in ISO code order");
});

test("phone: default country from the region, else the first entry; lists in region-code order", () => {
  assert.equal(defaultPhoneCountry(PHONE_COUNTRIES, "GB"), "+44");
  assert.equal(defaultPhoneCountry(PHONE_COUNTRIES, "ZZ"), "+86");
  assert.equal(defaultPhoneCountry(PHONE_COUNTRIES, ""), PHONE_COUNTRIES[0]!.code);
  const regions = PHONE_COUNTRIES.map((c) => c.region);
  assert.deepEqual(regions, sorted(regions), "phone countries in region-code order");
  assert.deepEqual(FORM_COUNTRY_CODES.map((c) => c.value), PHONE_COUNTRIES.map((c) => c.code), "form builder codes follow the same order");
});
