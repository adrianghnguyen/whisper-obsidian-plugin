import { describe, it, expect } from "vitest";
import {
	MAX_CUSTOM_VOCABULARY,
	parseCommaOrLineList,
	parseLanguageCodes,
} from "../src/transcribers/geminiPrompt";

describe("parseCommaOrLineList", () => {
	it("returns empty for blank input", () => {
		expect(parseCommaOrLineList("")).toEqual([]);
		expect(parseCommaOrLineList("   ")).toEqual([]);
	});

	it("splits comma-separated terms", () => {
		expect(parseCommaOrLineList("Gemini, Kubernetes, BigQuery")).toEqual([
			"Gemini",
			"Kubernetes",
			"BigQuery",
		]);
	});

	it("splits line-separated terms", () => {
		expect(parseCommaOrLineList("Gemini\nKubernetes\nBigQuery")).toEqual([
			"Gemini",
			"Kubernetes",
			"BigQuery",
		]);
	});

	it("caps at the API limit", () => {
		const terms = Array.from(
			{ length: MAX_CUSTOM_VOCABULARY + 5 },
			(_, i) => `term${i}`
		);
		expect(parseCommaOrLineList(terms.join(", "))).toHaveLength(
			MAX_CUSTOM_VOCABULARY
		);
	});
});

describe("parseLanguageCodes", () => {
	it("parses comma-separated BCP-47 codes", () => {
		expect(parseLanguageCodes("en-US, fr-CA")).toEqual(["en-US", "fr-CA"]);
	});
});
