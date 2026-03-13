#!/usr/bin/env bun
/**
 * Splits a video + SRT into N chunk folders for independent IPGU validation.
 *
 * Each chunk folder contains:
 *   - video.mp4   (video segment)
 *   - audio.mp3   (extracted audio)
 *   - subs.srt    (subtitles re-timed relative to chunk start)
 *
 * Usage:
 *   bun run chunk-video -- --video <path> --srt <path> [--chunks 10]
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, join, parse as parsePath } from "path";
import { Command } from "commander";

// ── Types ──────────────────────────────────────────────────────────────────

interface SrtEntry {
  index: number;
  start: number;
  end: number;
  text: string;
}

// ── SRT helpers ────────────────────────────────────────────────────────────

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
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "," +
    String(ms).padStart(3, "0")
  );
}

function parseSrt(path: string): SrtEntry[] {
  let text = readFileSync(path, "utf-8");
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const blocks = text.trim().split(/\n\n+/);
  const entries: SrtEntry[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    const index = parseInt(lines[0].trim());
    if (isNaN(index)) continue;

    const timingMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timingMatch) continue;

    entries.push({
      index,
      start: tsToSecs(timingMatch[1]),
      end: tsToSecs(timingMatch[2]),
      text: lines.slice(2).join("\n"),
    });
  }

  return entries;
}

function writeSrt(entries: SrtEntry[], path: string, offset: number): void {
  let content = "";
  entries.forEach((e, i) => {
    content += `${i + 1}\n`;
    content += `${secsToTs(e.start - offset)} --> ${secsToTs(e.end - offset)}\n`;
    content += `${e.text}\n\n`;
  });
  writeFileSync(path, content, "utf-8");
}

// ── ffmpeg / ffprobe helpers ───────────────────────────────────────────────

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${stderr}`));
      else resolve(stdout);
    });
  });
}

async function getVideoDuration(videoPath: string): Promise<number> {
  const out = await runCommand("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ]);
  return parseFloat(out.trim());
}

async function extractSegment(
  videoPath: string,
  start: number,
  end: number,
  outVideo: string,
  outAudio: string
): Promise<void> {
  const dur = end - start;

  // Video chunk (stream copy — fast)
  await runCommand("ffmpeg", [
    "-y", "-ss", String(start), "-i", videoPath,
    "-t", String(dur), "-c:v", "copy", "-c:a", "copy",
    outVideo,
  ]);

  // Audio extraction
  await runCommand("ffmpeg", [
    "-y", "-ss", String(start), "-i", videoPath,
    "-t", String(dur), "-vn", "-acodec", "libmp3lame",
    "-ar", "44100", "-ab", "192k",
    outAudio,
  ]);
}

// ── Split point logic ──────────────────────────────────────────────────────

function findSplitPoints(
  entries: SrtEntry[],
  duration: number,
  nChunks: number
): number[] {
  const idealChunk = duration / nChunks;

  // Build gaps between consecutive subtitle entries
  const gaps: [number, number][] = [];
  for (let i = 0; i < entries.length - 1; i++) {
    const gapStart = entries[i].end;
    const gapEnd = entries[i + 1].start;
    if (gapEnd > gapStart) {
      gaps.push([gapStart, gapEnd]);
    }
  }

  const splitPoints: number[] = [];
  for (let k = 1; k < nChunks; k++) {
    const target = idealChunk * k;
    let bestMid = target;
    let bestDist = Infinity;

    for (const [gs, ge] of gaps) {
      const mid = (gs + ge) / 2;
      const dist = Math.abs(mid - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestMid = mid;
      }
    }

    splitPoints.push(bestMid);
  }

  return splitPoints.sort((a, b) => a - b);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const program = new Command();
  program
    .name("chunk-video")
    .description("Split a video + SRT into N chunk folders for IPGU validation")
    .requiredOption("-v, --video <path>", "Path to video file")
    .requiredOption("-s, --srt <path>", "Path to SRT subtitle file")
    .option("-n, --chunks <number>", "Number of chunks", "10")
    .parse();

  const opts = program.opts();
  const videoPath: string = opts.video;
  const srtPath: string = opts.srt;
  const nChunks: number = parseInt(opts.chunks);

  if (!existsSync(videoPath)) {
    console.error(`Video not found: ${videoPath}`);
    process.exit(1);
  }
  if (!existsSync(srtPath)) {
    console.error(`SRT not found: ${srtPath}`);
    process.exit(1);
  }

  const videoName = parsePath(videoPath).name;
  const outDir = join("data", "video_chunked", `${videoName}_chunked`);

  console.log(`Video:   ${videoPath}`);
  console.log(`SRT:     ${srtPath}`);
  console.log(`Chunks:  ${nChunks}`);
  console.log(`Output:  ${outDir}`);

  const duration = await getVideoDuration(videoPath);
  console.log(`Duration: ${duration.toFixed(1)}s (${(duration / 60).toFixed(1)} min)`);

  const entries = parseSrt(srtPath);
  console.log(`Subtitle entries: ${entries.length}`);

  const splits = findSplitPoints(entries, duration, nChunks);
  const boundaries = [0, ...splits, duration];

  console.log(`\nSplit points:`);
  splits.forEach((sp, i) => {
    console.log(`  Cut ${i + 1}: ${secsToTs(sp)} (${sp.toFixed(1)}s)`);
  });

  mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < nChunks; i++) {
    const chunkStart = boundaries[i];
    const chunkEnd = boundaries[i + 1];
    const chunkDir = join(outDir, `chunk${String(i + 1).padStart(2, "0")}`);
    mkdirSync(chunkDir, { recursive: true });

    const chunkDur = chunkEnd - chunkStart;
    console.log(
      `\nChunk ${String(i + 1).padStart(2, "0")}: ${secsToTs(chunkStart)} -> ${secsToTs(chunkEnd)} (${chunkDur.toFixed(1)}s)`
    );

    await extractSegment(
      videoPath,
      chunkStart,
      chunkEnd,
      join(chunkDir, "video.mp4"),
      join(chunkDir, "audio.mp3")
    );

    const chunkSubs = entries.filter(
      (e) => e.start >= chunkStart && e.start < chunkEnd
    );
    writeSrt(chunkSubs, join(chunkDir, "subs.srt"), chunkStart);
    console.log(`  -> ${chunkSubs.length} subtitles, video + audio extracted`);
  }

  console.log(`\nDone. Output in ${outDir}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
