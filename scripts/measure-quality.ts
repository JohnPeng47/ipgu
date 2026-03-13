#!/usr/bin/env bun
/**
 * Measures IPGU output quality against reference SRT:
 *   1. Timing misalignment (absolute + signed cumulative)
 *   2. Subline count comparison (generated vs reference)
 *
 * Matches generated English subs to reference subs by closest start time.
 *
 * Usage:
 *   bun run measure-quality
 *   bun run measure-quality -- --chunk 3
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Command } from "commander";

// ── Types ──────────────────────────────────────────────────────────────────

interface Sub {
  index: number;
  start: number;
  end: number;
  text: string;
}

interface MatchedPair {
  ref: Sub;
  gen: Sub;
  startDiff: number; // gen.start - ref.start (positive = late, negative = early)
  endDiff: number;
}

// ── SRT parsing ────────────────────────────────────────────────────────────

function tsToSecs(ts: string): number {
  const [h, m, rest] = ts.split(":");
  const [s, ms] = rest.split(",");
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

function parseSrt(path: string): Sub[] {
  let text = readFileSync(path, "utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const blocks = text.trim().split(/\n\n+/);
  const entries: Sub[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const index = parseInt(lines[0].trim());
    if (isNaN(index)) continue;
    const m = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!m) continue;
    // Extract text, strip font tags, take only English (first font line)
    const textLines = lines.slice(2);
    const englishLine = textLines
      .map((l) => l.replace(/<\/?font[^>]*>/gi, "").trim())
      .filter((l) => l.length > 0);
    entries.push({
      index,
      start: tsToSecs(m[1]),
      end: tsToSecs(m[2]),
      text: englishLine[0] || "",
    });
  }
  return entries;
}

function parseRefSrt(path: string): Sub[] {
  let text = readFileSync(path, "utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const blocks = text.trim().split(/\n\n+/);
  const entries: Sub[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const index = parseInt(lines[0].trim());
    if (isNaN(index)) continue;
    const m = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!m) continue;
    const body = lines
      .slice(2)
      .map((l) => l.replace(/<\/?[^>]+>/g, "").trim())
      .filter((l) => l.length > 0)
      .join(" ");
    entries.push({
      index,
      start: tsToSecs(m[1]),
      end: tsToSecs(m[2]),
      text: body,
    });
  }
  return entries;
}

// ── Matching ───────────────────────────────────────────────────────────────

function matchSubs(refSubs: Sub[], genSubs: Sub[]): MatchedPair[] {
  const matched: MatchedPair[] = [];

  for (const ref of refSubs) {
    let bestIdx = -1;
    let bestDist = Infinity;

    // Allow multiple ref subs to match the same gen sub (handles merges)
    for (let i = 0; i < genSubs.length; i++) {
      const dist = Math.abs(genSubs[i].start - ref.start);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestDist <= 10) {
      const gen = genSubs[bestIdx];
      matched.push({
        ref,
        gen,
        startDiff: gen.start - ref.start,
        endDiff: gen.end - ref.end,
      });
    }
  }

  return matched;
}

// ── Formatting ─────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  const s = n.toFixed(decimals);
  return n >= 0 ? `+${s}` : s;
}

function fmtSecs(n: number): string {
  return n.toFixed(2) + "s";
}

// ── Per-chunk report ───────────────────────────────────────────────────────

function reportChunk(chunkName: string, refPath: string, genPath: string, mode: string) {
  const refSubs = parseRefSrt(refPath);
  const genSubs = parseSrt(genPath);
  const pairs = matchSubs(refSubs, genSubs);

  const absSum = pairs.reduce((s, p) => s + Math.abs(p.startDiff), 0);
  const signedSum = pairs.reduce((s, p) => s + p.startDiff, 0);
  const absEndSum = pairs.reduce((s, p) => s + Math.abs(p.endDiff), 0);
  const signedEndSum = pairs.reduce((s, p) => s + p.endDiff, 0);
  const avgAbs = pairs.length > 0 ? absSum / pairs.length : 0;
  const avgSigned = pairs.length > 0 ? signedSum / pairs.length : 0;

  return {
    chunkName,
    mode,
    refCount: refSubs.length,
    genCount: genSubs.length,
    matchedCount: pairs.length,
    startAbsSum: absSum,
    startSignedSum: signedSum,
    startAvgAbs: avgAbs,
    startAvgSigned: avgSigned,
    endAbsSum: absEndSum,
    endSignedSum: signedEndSum,
    pairs,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

const program = new Command();
program
  .name("measure-quality")
  .description("Measure IPGU output quality against reference subtitles")
  .option("-c, --chunk <number>", "Only measure a specific chunk number")
  .parse();

const opts = program.opts();

const VIDEO_NAME = "AnimePahe_Tamayura_-_Sotsugyou_Shashin_Part_3_-_Akogare_-_01_BD_720p_Nishi-Taku";
const DATA_DIR = join(import.meta.dir, "..", "data");
const REF_BASE = join(DATA_DIR, "video_chunked", `${VIDEO_NAME}_chunked`);
const OUT_BASE = join(DATA_DIR, "output", `${VIDEO_NAME}_chunked`);

const chunks = readdirSync(REF_BASE)
  .filter((d) => d.startsWith("chunk"))
  .sort();

const filteredChunks = opts.chunk
  ? chunks.filter((c) => c === `chunk${String(opts.chunk).padStart(2, "0")}`)
  : chunks;

const modes = ["with_srt", "no_srt"] as const;

console.log("=".repeat(80));
console.log("  IPGU Quality Metrics");
console.log("=".repeat(80));

for (const mode of modes) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`  Mode: ${mode}`);
  console.log(`${"─".repeat(80)}`);

  let totalRefCount = 0;
  let totalGenCount = 0;
  let totalMatched = 0;
  let grandAbsSum = 0;
  let grandSignedSum = 0;

  console.log(
    "\n" +
      "Chunk".padEnd(10) +
      "Ref".padStart(5) +
      "Gen".padStart(5) +
      "Match".padStart(7) +
      "  │ " +
      "Abs Σ".padStart(9) +
      "Signed Σ".padStart(10) +
      "Avg |Δ|".padStart(10) +
      "Avg Δ".padStart(10)
  );
  console.log("─".repeat(10) + "─".repeat(17) + "──┼─" + "─".repeat(39));

  for (const chunkDir of filteredChunks) {
    const refPath = join(REF_BASE, chunkDir, "subs.srt");
    const genPath = join(OUT_BASE, chunkDir, mode, "video.bilingual.korean.srt");

    if (!existsSync(refPath) || !existsSync(genPath)) {
      console.log(`${chunkDir.padEnd(10)} MISSING FILES`);
      continue;
    }

    const r = reportChunk(chunkDir, refPath, genPath, mode);

    totalRefCount += r.refCount;
    totalGenCount += r.genCount;
    totalMatched += r.matchedCount;
    grandAbsSum += r.startAbsSum;
    grandSignedSum += r.startSignedSum;

    console.log(
      r.chunkName.padEnd(10) +
        String(r.refCount).padStart(5) +
        String(r.genCount).padStart(5) +
        String(r.matchedCount).padStart(7) +
        "  │ " +
        fmtSecs(r.startAbsSum).padStart(9) +
        fmt(r.startSignedSum).padStart(10) +
        "s" +
        fmtSecs(r.startAvgAbs).padStart(9) +
        fmt(r.startAvgSigned).padStart(10) +
        "s"
    );
  }

  const grandAvgAbs = totalMatched > 0 ? grandAbsSum / totalMatched : 0;
  const grandAvgSigned = totalMatched > 0 ? grandSignedSum / totalMatched : 0;

  console.log("─".repeat(10) + "─".repeat(17) + "──┼─" + "─".repeat(39));
  console.log(
    "TOTAL".padEnd(10) +
      String(totalRefCount).padStart(5) +
      String(totalGenCount).padStart(5) +
      String(totalMatched).padStart(7) +
      "  │ " +
      fmtSecs(grandAbsSum).padStart(9) +
      fmt(grandSignedSum).padStart(10) +
      "s" +
      fmtSecs(grandAvgAbs).padStart(9) +
      fmt(grandAvgSigned).padStart(10) +
      "s"
  );

  const countDiff = totalGenCount - totalRefCount;
  console.log(
    `\n  Subline delta: ${countDiff >= 0 ? "+" : ""}${countDiff} (generated ${totalGenCount} vs reference ${totalRefCount})`
  );
  console.log(`  Matched pairs: ${totalMatched} / ${totalRefCount} reference subs (${((totalMatched / totalRefCount) * 100).toFixed(1)}%)`);
  console.log(`  Cumulative timing (magnitude): ${fmtSecs(grandAbsSum)}`);
  console.log(`  Cumulative timing (signed):    ${fmt(grandSignedSum)}s  ${grandSignedSum > 0 ? "(subs appear LATE on avg)" : "(subs appear EARLY on avg)"}`);
  console.log(`  Average per-sub misalignment:  ${fmtSecs(grandAvgAbs)}`);
}
