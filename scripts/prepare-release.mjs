#!/usr/bin/env node
/**
 * Prepares release folder with all plugin binaries for GitHub release attachment.
 * Copies main.js, manifest.json, styles.css into release/
 * Run after build, as part of release-it before:release.
 */

import { existsSync, mkdirSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const releaseDir = join(root, "release");

const assets = ["main.js", "manifest.json", "styles.css", "package.json"];

for (const asset of assets) {
	const src = join(root, asset);
	if (!existsSync(src)) {
		console.error(`Error: ${asset} not found. Run 'npm run build' first.`);
		process.exit(1);
	}
}

if (!existsSync(releaseDir)) {
	mkdirSync(releaseDir, { recursive: true });
}

for (const asset of assets) {
	const src = join(root, asset);
	const dest = join(releaseDir, asset);
	copyFileSync(src, dest);
	console.log(`Copied ${asset} → release/`);
}

console.log("Release folder prepared.");
