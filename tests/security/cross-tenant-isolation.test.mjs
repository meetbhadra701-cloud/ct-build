import assert from "node:assert/strict";
import test from "node:test";

const vendors = [
  {
    id: "vendor-a",
    account_id: "account-a",
    name: "Tenant A Vendor"
  },
  {
    id: "vendor-b",
    account_id: "account-b",
    name: "Tenant B Vendor"
  }
];

function listVendorsForAccount(accountId) {
  return vendors.filter((vendor) => vendor.account_id === accountId);
}

function getVendorForAccount(id, accountId) {
  return vendors.find((vendor) => vendor.id === id && vendor.account_id === accountId) ?? null;
}

test("tenant A cannot list tenant B vendors", () => {
  const result = listVendorsForAccount("account-a");

  assert.deepEqual(
    result.map((vendor) => vendor.id),
    ["vendor-a"]
  );
});

test("tenant A cannot read tenant B vendor by id", () => {
  const result = getVendorForAccount("vendor-b", "account-a");

  assert.equal(result, null);
});
