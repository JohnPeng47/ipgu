#!/usr/bin/env bun
/**
 * Side-by-side comparison of reference vs generated subtitles.
 * Shows matched pairs with timing misalignment and full text.
 *
 * Usage:
 *   bun run compare-subs -- --chunk 1 --mode with_srt
 *   bun run compare-subs -- --chunk 3 --mode no_srt
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

interface MatchGroup {
  genSub: Sub;
  refSubs: Sub[];
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

function shortTs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.round((secs % 1) * 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
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

// ── Matching: group ref subs by nearest gen sub ────────────────────────────

function buildMatchGroups(refSubs: Sub[], genSubs: Sub[]): MatchGroup[] {
  // For each ref sub, find nearest gen sub
  const genToRefs = new Map<number, Sub[]>();

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
      if (!genToRefs.has(bestIdx)) genToRefs.set(bestIdx, []);
      genToRefs.get(bestIdx)!.push(ref);
    }
  }

  // Also find unmatched gen subs (no ref matched to them)
  const groups: MatchGroup[] = [];
  for (let i = 0; i < genSubs.length; i++) {
    groups.push({
      genSub: genSubs[i],
      refSubs: genToRefs.get(i) || [],
    });
  }

  // Find unmatched ref subs
  const matchedRefs = new Set<number>();
  for (const refs of genToRefs.values()) {
    for (const r of refs) matchedRefs.add(r.index);
  }
  const unmatchedRefs = refSubs.filter((r) => !matchedRefs.has(r.index));

  groups.sort((a, b) => a.genSub.start - b.genSub.start);

  return { groups, unmatchedRefs } as any;
}

// ── Display ────────────────────────────────────────────────────────────────

function fmtDiff(diff: number): string {
  const s = diff.toFixed(2);
  return diff >= 0 ? `+${s}s` : `${s}s`;
}

function drawTimingBar(diff: number, maxDiff: number, width: number): string {
  const half = Math.floor(width / 2);
  const chars = Array(width).fill(" ");
  chars[half] = "│";

  const cells = maxDiff > 0 ? Math.min(half, Math.round((Math.abs(diff) / maxDiff) * half)) : 0;

  if (diff < 0) {
    for (let i = 0; i < cells && half - 1 - i >= 0; i++) chars[half - 1 - i] = "◄";
  } else if (diff > 0) {
    for (let i = 0; i < cells && half + 1 + i < width; i++) chars[half + 1 + i] = "►";
  }
  return chars.join("");
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
}

function printComparison(
  chunkName: string,
  mode: string,
  refSubs: Sub[],
  genSubs: Sub[]
) {
  // Build match groups
  const genToRefs = new Map<number, Sub[]>();
  const matchedRefIdxs = new Set<number>();

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
      if (!genToRefs.has(bestIdx)) genToRefs.set(bestIdx, []);
      genToRefs.get(bestIdx)!.push(ref);
      matchedRefIdxs.add(ref.index);
    }
  }

  const unmatchedRefs = refSubs.filter((r) => !matchedRefIdxs.has(r.index));
  const unmatchedGens: number[] = [];
  for (let i = 0; i < genSubs.length; i++) {
    if (!genToRefs.has(i)) unmatchedGens.push(i);
  }

  // Compute max diff for bar scaling
  let maxDiff = 0.1;
  for (const [gi, refs] of genToRefs) {
    for (const ref of refs) {
      maxDiff = Math.max(maxDiff, Math.abs(genSubs[gi].start - ref.start));
    }
  }

  const W = 70; // text column width
  const BAR_W = 21;

  console.log();
  console.log("═".repeat(W + 30));
  console.log(`  ${chunkName} [${mode}]`);
  console.log(`  Reference: ${refSubs.length} subs    Generated: ${genSubs.length} subs    Max Δ: ${maxDiff.toFixed(2)}s`);
  console.log("═".repeat(W + 30));

  // Walk through gen subs in order
  const sortedGenIdxs = Array.from({ length: genSubs.length }, (_, i) => i).sort(
    (a, b) => genSubs[a].start - genSubs[b].start
  );

  let pairNum = 0;
  for (const gi of sortedGenIdxs) {
    const gen = genSubs[gi];
    const refs = genToRefs.get(gi) || [];
    const isUnmatchedGen = refs.length === 0;

    pairNum++;
    // Top border with pair label
    const pairLabel = isUnmatchedGen ? `── (unmatched gen) ` : `── pair ${pairNum} `;
    console.log(`  ┌${pairLabel}${"─".repeat(Math.max(0, W + 26 - pairLabel.length))}┐`);

    // Reference sub(s) — top
    if (refs.length === 0) {
      console.log(`  │  REF: ${"(no match)".padEnd(W + 20)}│`);
    } else {
      for (let ri = 0; ri < refs.length; ri++) {
        const ref = refs[ri];
        const refTime = `${shortTs(ref.start)} → ${shortTs(ref.end)}`;
        const prefix = ri === 0 ? "REF" : "   ";
        const marker = refs.length > 1 ? ` [${ri + 1}/${refs.length}]` : "";
        const refText = truncate(ref.text, W - 2);
        console.log(`  │  ${prefix}: ${refTime.padEnd(20)}${marker.padEnd(8)} ${refText.padEnd(W - 2)}│`);
        if (ri < refs.length - 1) {
          console.log(`  │  ${"·".repeat(W + 24)}  │`);
        }
      }
    }

    // Separator with timing bar
    const primaryRef = refs[0];
    if (primaryRef) {
      const diff = gen.start - primaryRef.start;
      const bar = drawTimingBar(diff, maxDiff, BAR_W);
      const diffStr = fmtDiff(diff);
      console.log(`  ├──── ${diffStr.padEnd(8)} ${bar} ${"─".repeat(Math.max(0, W + 26 - 10 - BAR_W - 2))}┤`);
    } else {
      console.log(`  ├${"─".repeat(W + 26)}┤`);
    }

    // Generated sub — bottom
    const genTime = `${shortTs(gen.start)} → ${shortTs(gen.end)}`;
    const genText = truncate(gen.text, W - 2);
    const genLabel = isUnmatchedGen ? "GEN: (unmatched)" : "GEN:";
    console.log(`  │  ${genLabel.padEnd(5)} ${genTime.padEnd(20)}         ${genText.padEnd(W - 2)}│`);

    // Bottom border
    console.log(`  └${"─".repeat(W + 26)}┘`);
  }

  // Show unmatched reference subs
  if (unmatchedRefs.length > 0) {
    console.log();
    console.log(`  ┌─ UNMATCHED REFERENCE SUBS (${unmatchedRefs.length}) ${"─".repeat(Math.max(0, W + 26 - 35))}┐`);
    for (const ref of unmatchedRefs) {
      const refTime = `${shortTs(ref.start)} → ${shortTs(ref.end)}`;
      const refText = truncate(ref.text, W - 2);
      console.log(`  │  #${String(ref.index).padEnd(4)} ${refTime.padEnd(20)}  ${refText.padEnd(W)}│`);
    }
    console.log(`  └${"─".repeat(W + 26)}┘`);
  }

  // Summary
  const totalAbsDiff = Array.from(genToRefs.entries()).reduce((sum, [gi, refs]) => {
    return sum + refs.reduce((s, r) => s + Math.abs(genSubs[gi].start - r.start), 0);
  }, 0);
  const totalPairs = Array.from(genToRefs.values()).reduce((s, refs) => s + refs.length, 0);
  const mergedCount = Array.from(genToRefs.values()).filter((refs) => refs.length > 1).length;

  console.log();
  console.log(`  Summary: ${totalPairs} matched pairs, ${mergedCount} merged groups, ${unmatchedRefs.length} unmatched ref, ${unmatchedGens.length} unmatched gen`);
  console.log(`  Avg |Δ|: ${(totalAbsDiff / Math.max(totalPairs, 1)).toFixed(2)}s`);
}

// ── Main ───────────────────────────────────────────────────────────────────

const program = new Command();
program
  .name("compare-subs")
  .description("Side-by-side subtitle comparison with timing alignment")
  .requiredOption("-c, --chunk <number>", "Chunk number")
  .option("-m, --mode <mode>", "Mode: with_srt or no_srt", "with_srt")
  .parse();

const cliOpts = program.opts();
const chunkId = `chunk${String(cliOpts.chunk).padStart(2, "0")}`;
const mode = cliOpts.mode;

const VIDEO_NAME =
  "AnimePahe_Tamayura_-_Sotsugyou_Shashin_Part_3_-_Akogare_-_01_BD_720p_Nishi-Taku";
const DATA_DIR = join(import.meta.dir, "..", "data");
const refPath = join(DATA_DIR, "video_chunked", `${VIDEO_NAME}_chunked`, chunkId, "subs.srt");
const genPath = join(DATA_DIR, "output", `${VIDEO_NAME}_chunked`, chunkId, mode, "video.bilingual.korean.srt");

if (!existsSync(refPath)) {
  console.error(`Reference SRT not found: ${refPath}`);
  process.exit(1);
}
if (!existsSync(genPath)) {
  console.error(`Generated SRT not found: ${genPath}`);
  process.exit(1);
}

const refSubs = parseSrt(refPath, false);
const genSubs = parseSrt(genPath, true);

printComparison(chunkId, mode, refSubs, genSubs);
