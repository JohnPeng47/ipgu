# IPGU Validation Progress

## What exists

**Source material** (in `data/`, gitignored):
- Japanese anime video (51.9 min) + English reference SRT (899 entries)

**Chunked input** (`data/chunks/chunk{01-10}/`):
- 10 chunks (~5 min each), split at subtitle gaps
- Each has: `video.mp4`, `audio.mp3`, `subs.srt` (re-timed to 00:00:00)

**IPGU output** (`data/output/chunk{01-10}/`):
- `with_srt/` — IPGU run with reference SRT passed in
- `no_srt/` — IPGU run without reference SRT (`--use-response-timings`)
- Each contains: `video.bilingual.korean.srt`, `video_with_subs.mp4` (burned in), `intermediates/`, `run.log`
- All 20 runs succeeded. Model: `gemini-2.5-pro`. Cost: ~$2.10 total.
- Output is bilingual English+Korean (Korean was unintended; English lines are the ones to evaluate)

**Scripts**:
- `scripts/chunk-video.ts` — reusable chunker: `bun run chunk-video -- --video <path> --srt <path> [--chunks N]`
- `data/run_ipgu_validation.sh` — ran IPGU on all chunks in both modes
- `data/burn_subs.sh` — burned SRTs onto video with black backdrop

## Gotchas
- Preset model `gemini-2.5-pro-preview-03-25` expired → use `gemini-2.5-pro`
- `--chunk-duration` must be ≥ actual video length (75% span validation threshold)

## Not yet done
- Extract English-only lines from bilingual output for clean diff against reference
- Quantitative comparison of IPGU English vs reference subs
