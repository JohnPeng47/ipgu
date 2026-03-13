#!/usr/bin/env bun
/**
 * ASCII visualization of per-subline timing alignment between
 * IPGU output and reference SRT (English lines only).
 *
 * Shows each matched pair as a horizontal bar depicting how much
 * the generated sub is early/late relative to the reference.
 *
 * Usage:
 *   bun run viz-alignment
 *   bun run viz-alignment -- --chunk 3
 *   bun run viz-alignment -- --mode no_srt
 *   bun run viz-alignment -- --chunk 1 --mode with_srt
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

// ── SRT parsing ────────────────────────────────────────────────────────────

function tsToSecs(ts: string): number {
  const [h, m, rest] = ts.split(":");
  const [s, ms] = rest.split(",");
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

function secsToTs(secs: number): string {
  if (secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.round((secs % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function parseSrt(path: string, extractEnglish: boolean): Sub[] {
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

    const textLines = lines.slice(2);
    let body: string;
    if (extractEnglish) {
      // Take first non-empty line after stripping font tags
      body = textLines
        .map((l) => l.replace(/<\/?font[^>]*>/gi, "").replace(/<\/?i>/gi, "").trim())
        .filter((l) => l.length > 0)[0] || "";
    } else {
      body = textLines
        .map((l) => l.replace(/<\/?[^>]+>/g, "").trim())
        .filter((l) => l.length > 0)
        .join(" ");
    }

    entries.push({ index, start: tsToSecs(m[1]), end: tsToSecs(m[2]), text: body });
  }
  return entries;
}

// ── Matching ───────────────────────────────────────────────────────────────

interface MatchedPair {
  ref: Sub;
  gen: Sub;
  startDiff: number;
}

function matchSubs(refSubs: Sub[], genSubs: Sub[]): MatchedPair[] {
  const matched: MatchedPair[] = [];

  for (const ref of refSubs) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < genSubs.length; i++) {
      const dist = Math.abs(genSubs[i].start - ref.start);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestDist <= 10) {
      matched.push({
        ref,
        gen: genSubs[bestIdx],
        startDiff: genSubs[bestIdx].start - ref.start,
      });
    }
  }
  return matched;
}

// ── Visualization ──────────────────────────────────────────────────────────

function drawBar(diff: number, maxDiff: number, barWidth: number): string {
  const half = Math.floor(barWidth / 2);
  const chars = Array(barWidth).fill(" ");

  // Center marker
  chars[half] = "│";

  // How many cells does this diff occupy?
  const cells = maxDiff > 0 ? Math.round((Math.abs(diff) / maxDiff) * half) : 0;

  if (diff < 0) {
    // Early — draw left of center
    for (let i = 0; i < cells && half - 1 - i >= 0; i++) {
      chars[half - 1 - i] = "◄";
    }
  } else if (diff > 0) {
    // Late — draw right of center
    for (let i = 0; i < cells && half + 1 + i < barWidth; i++) {
      chars[half + 1 + i] = "►";
    }
  }

  return chars.join("");
}

function visualizeChunk(chunkName: string, refPath: string, genPath: string, mode: string) {
  const refSubs = parseSrt(refPath, false);
  const genSubs = parseSrt(genPath, true);
  const pairs = matchSubs(refSubs, genSubs);

  if (pairs.length === 0) {
    console.log(`  No matched pairs found.\n`);
    return;
  }

  const maxDiff = Math.max(...pairs.map((p) => Math.abs(p.startDiff)), 0.1);
  const BAR_WIDTH = 41; // odd number so center is clear

  console.log(`\n  ${chunkName} [${mode}]  (${refSubs.length} ref, ${genSubs.length} gen, ${pairs.length} matched)`);
  console.log(`  Max misalignment: ${maxDiff.toFixed(2)}s`);
  console.log();

  // Header
  const earlyLabel = `◄ EARLY (${maxDiff.toFixed(1)}s)`;
  const lateLabel = `LATE (${maxDiff.toFixed(1)}s) ►`;
  const headerPad = BAR_WIDTH - earlyLabel.length - lateLabel.length;
  console.log(
    "  " +
      "#".padStart(4) +
      "  " +
      "Ref Time".padEnd(13) +
      "Δ".padStart(7) +
      "  " +
      earlyLabel +
      " ".repeat(Math.max(1, headerPad)) +
      lateLabel +
      "  " +
      "Text"
  );
  console.log("  " + "─".repeat(4 + 2 + 13 + 7 + 2 + BAR_WIDTH + 2 + 20));

  for (const pair of pairs) {
    const diffStr =
      (pair.startDiff >= 0 ? "+" : "") + pair.startDiff.toFixed(2) + "s";
    const bar = drawBar(pair.startDiff, maxDiff, BAR_WIDTH);
    const textPreview = pair.ref.text.slice(0, 30);

    console.log(
      "  " +
        String(pair.ref.index).padStart(4) +
        "  " +
        secsToTs(pair.ref.start).padEnd(13) +
        diffStr.padStart(7) +
        "  " +
        bar +
        "  " +
        textPreview
    );
  }

  // Summary line
  const absSum = pairs.reduce((s, p) => s + Math.abs(p.startDiff), 0);
  const signedSum = pairs.reduce((s, p) => s + p.startDiff, 0);
  console.log("  " + "─".repeat(4 + 2 + 13 + 7 + 2 + BAR_WIDTH + 2 + 20));
  console.log(
    `  Σ|Δ| = ${absSum.toFixed(2)}s    ΣΔ = ${(signedSum >= 0 ? "+" : "") + signedSum.toFixed(2)}s    avg|Δ| = ${(absSum / pairs.length).toFixed(2)}s`
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const program = new Command();
program
  .name("visualize-alignment")
  .description("ASCII visualization of subtitle timing alignment")
  .option("-c, --chunk <number>", "Only show a specific chunk number")
  .option("-m, --mode <mode>", "Only show a specific mode (with_srt or no_srt)")
  .parse();

const cliOpts = program.opts();

const VIDEO_NAME =
  "AnimePahe_Tamayura_-_Sotsugyou_Shashin_Part_3_-_Akogare_-_01_BD_720p_Nishi-Taku";
const DATA_DIR = join(import.meta.dir, "..", "data");
const REF_BASE = join(DATA_DIR, "video_chunked", `${VIDEO_NAME}_chunked`);
const OUT_BASE = join(DATA_DIR, "output", `${VIDEO_NAME}_chunked`);

const chunks = readdirSync(REF_BASE)
  .filter((d) => d.startsWith("chunk"))
  .sort();

const filteredChunks = cliOpts.chunk
  ? chunks.filter((c) => c === `chunk${String(cliOpts.chunk).padStart(2, "0")}`)
  : chunks;

const modes = cliOpts.mode ? [cliOpts.mode] : ["with_srt", "no_srt"];

console.log("=".repeat(80));
console.log("  IPGU Timing Alignment Visualization");
console.log("=".repeat(80));

for (const mode of modes) {
  for (const chunkDir of filteredChunks) {
    const refPath = join(REF_BASE, chunkDir, "subs.srt");
    const genPath = join(OUT_BASE, chunkDir, mode, "video.bilingual.korean.srt");

    if (!existsSync(refPath) || !existsSync(genPath)) {
      console.log(`\n  ${chunkDir} [${mode}] — MISSING FILES`);
      continue;
    }

    visualizeChunk(chunkDir, refPath, genPath, mode);
  }
}
