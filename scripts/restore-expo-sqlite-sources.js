#!/usr/bin/env node

/**
 * expo-sqlite's podspec copies its vendored sqlite3.c/sqlite3.h into
 * node_modules/expo-sqlite/ios/ only when `pod install` runs. A fresh
 * `npm install` wipes those copies, and because Podfile.lock is unchanged,
 * `expo run:ios` doesn't re-run pod install, so the iOS build fails with
 * "cannot find 'exsqlite3_open' in scope". Restore the copies after install.
 */

const fs = require("fs");
const path = require("path");

const sqliteDir = path.join(__dirname, "..", "node_modules", "expo-sqlite");
const propertiesPath = path.join(__dirname, "..", "ios", "Podfile.properties.json");

if (!fs.existsSync(sqliteDir)) {
  process.exit(0);
}

let properties = {};
try {
  properties = JSON.parse(fs.readFileSync(propertiesPath, "utf8"));
} catch {}

const vendorSrc = properties["expo.sqlite.useSQLCipher"] === "true" ? "sqlcipher" : "sqlite3";

for (const file of ["sqlite3.c", "sqlite3.h"]) {
  const source = path.join(sqliteDir, "vendor", vendorSrc, file);
  const destination = path.join(sqliteDir, "ios", file);
  if (fs.existsSync(source) && !fs.existsSync(destination)) {
    fs.copyFileSync(source, destination);
  }
}
