"use strict";
const assert = require("assert").strict;
const fs = require("fs-extra");
const lib = require("@clusterio/lib");

describe("lib/ini", function() {
	describe("parse()", function() {
		it("should ignore comments", function() {
			assert.deepEqual(
				lib.parse("# A comment\n; Another comment\nfoo=bar\n"),
				{ foo: "bar" },
			);
		});
		it("should ignore certain whitespace", function() {
			assert.deepEqual(
				lib.parse("  # A comment  \n\n [spam] \t \n \tfoo=bar\n"),
				{ spam: { foo: "bar" }}
			);
		});
		it("should preserve certain whitespace", function() {
			assert.deepEqual(
				lib.parse("[\t spam\t ]\nfoo =\t bar \n"),
				{ "\t spam\t ": { "foo ": "\t bar " }}
			);
		});
		it("should not treat characters specially", function() {
			assert.deepEqual(
				lib.parse("[#;spam]\nfoo#;=#;bar=#;'\""),
				{ "#;spam": { "foo#;": "#;bar=#;'\"" }}
			);
		});
		it("should handle windows line endings", function() {
			assert.deepEqual(
				lib.parse("[spam]\r\nfoo=bar\r\n"),
				{ "spam": { "foo": "bar" }}
			);
		});
		it("should throw on incomplete section", function() {
			assert.throws(
				() => lib.parse("[spam"),
				new Error("Unterminated section header on line 1")
			);
		});
		it("should throw on missing value", function() {
			assert.throws(
				() => lib.parse("key"),
				new Error("Missing value for key key on line 1")
			);
		});
		it("should throw on duplicated section", function() {
			assert.throws(
				() => lib.parse("[spam]\n[spam]\n"),
				new Error("Duplicated section [spam] on line 2")
			);
		});
		it("should throw on duplicated keys", function() {
			assert.throws(
				() => lib.parse("key=value\nkey=value\n"),
				new Error("Duplicated key key on line 2")
			);
		});
		it("should parse a file with BOM", async function() {
			assert.deepEqual(
				lib.parse(await fs.readFile("test/file/bom.cfg", "utf8")),
				{ spam: { foo: "bar" }},
			);
		});
	});
	describe("stringify()", function() {
		it("should serialize to reference output", function() {
			let cases = [
				[{}, ""],
				[{ foo: "bar" }, "foo=bar\n"],
				[{ foo: { spam: "one", bar: "two" }}, "[foo]\nspam=one\nbar=two\n"],
				[
					{ start: "alpha", foo: { spam: "one", bar: "two" }, end: "beta" },
					"start=alpha\nend=beta\n\n[foo]\nspam=one\nbar=two\n",
				],
				[{ "trail ": "\t tabs \t" }, "trail =\t tabs \t\n"],
				[{ "#;spam": { "foo#;": "#;bar=#;'\"" }}, "[#;spam]\nfoo#;=#;bar=#;'\"\n"],
			];
			for (let [input, expected] of cases) {
				assert.equal(lib.stringify(input), expected);
			}
		});
	});
	it("should round trip object", function() {
		for (let expected of [
			{},
			{ simple: "value" },
			{ section: { foo: "false", bar: "text" }},
			{ mixed: "root", section: { foo: "1", bar: "2" }, end: "value" },
			{ first: { foo: "1", bar: "2" }, second: { spam: "true" }},
			{ '"#;[] ': ' "#;[] ', ' #;"[ ': { '"#;[] ': ' "#;[ ' }},
		]) {
			let actual = lib.parse(lib.stringify(expected));
			assert.deepEqual(actual, expected);
		}
	});
});
