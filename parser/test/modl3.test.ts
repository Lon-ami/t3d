import * as fs from "fs";

import { DataParser } from "../src/data-parser";
import { parseFile, parseAllChunks } from "../src/utils";

import {  toArrayBuffer } from "./test-helper";

import * as MODL from "../definitions/MODL";
import * as GEOM from "../definitions/GEOM";
import * as ROOT from "../definitions/ROOT";

const chunkBuffer = fs.readFileSync("./test/content/modl3.bin", null);
const dv = new DataView(toArrayBuffer(chunkBuffer));
const fileHead = parseFile(dv);
const allChunks = parseAllChunks(dv, fileHead.newPosition);
const is64Bit = fileHead.data.flags == 5;

describe("modl3", () => {
  test("matches for MODL", function () {
    const modlChunk = allChunks.find((c) => c.chunkHeader.type === "MODL");
    const def = MODL.definitions[`V${modlChunk!.chunkHeader.chunkVersion}` as keyof typeof MODL["definitions"]];
    const test = new DataParser(def, is64Bit).parse(dv, modlChunk!.chunkPosition + modlChunk!.chunkHeader.chunkHeaderSize);
    expect(test.data).toMatchSnapshot("modl3-modl")
  });

  // GEOM
  test("matches for GEOM", function () {
    const geomChunk = allChunks.find((c) => c.chunkHeader.type === "GEOM");
    const def = GEOM.definitions[`V${geomChunk!.chunkHeader.chunkVersion}` as keyof typeof GEOM["definitions"]];
    const parser = new DataParser(def, is64Bit);
    // parser.DEBUG = true;
    const test = parser.parse(dv, geomChunk!.chunkPosition + geomChunk!.chunkHeader.chunkHeaderSize);

    expect(test.data).toMatchSnapshot("modl3-geom")
  });

  //ROOT
  test("matches for ROOT", function () {
    const rootChunk = allChunks.find((c) => c.chunkHeader.type === "ROOT");
    const def = ROOT.definitions[`V${rootChunk!.chunkHeader.chunkVersion}` as keyof typeof ROOT["definitions"]];
    const parser = new DataParser(def, is64Bit);
    //parser.DEBUG = true;
    const test = parser.parse(dv, rootChunk!.chunkPosition + rootChunk!.chunkHeader.chunkHeaderSize);
    expect(test.data).toMatchSnapshot("modl3-root")
  });
});