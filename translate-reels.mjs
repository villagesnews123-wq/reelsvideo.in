// Translate only the `reels` PageContent block into every non-English locale
// and patch each src/i18n/pages.<code>.ts file by replacing its `reels: { ... }` block.
import fs from "node:fs/promises";

const KEY = process.env.LOVABLE_API_KEY;
if (!KEY) { console.error("LOVABLE_API_KEY missing"); process.exit(1); }

const TARGETS = [
  ["hi", "Hindi"], ["es", "Spanish"], ["pt", "Portuguese (Brazil)"],
  ["id", "Indonesian"], ["fr", "French"], ["ja", "Japanese"],
  ["ru", "Russian"], ["tr", "Turkish"], ["vi", "Vietnamese"],
  ["ar", "Arabic"], ["th", "Thai"], ["it", "Italian"],
  ["pl", "Polish"], ["uk", "Ukrainian"], ["nl", "Dutch"],
];

// Extract reels block from EN source by parsing.
const enSrc = await fs.readFile("src/i18n/pages.en.ts", "utf8");
const tmp = "/tmp/pages-en-reels.mjs";
await fs.writeFile(tmp,
  enSrc.replace(/^import[^\n]*\n/gm, "").replace(/export const en: LocaleStrings =/, "export const en =")
);
const { en } = await import(tmp + "?t=" + Date.now());
const REELS_EN = en.pages.reels;

async function translate(code, name) {
  const sys = `Translate ALL string values of this JSON object (an Instagram Reels downloader landing page) into ${name} (locale: ${code}).
Rules:
- Keep the exact JSON shape and all keys unchanged.
- Translate values only. Keep brand names as-is: ReelsVideo, InstaReelsDL, FastDL, Instagram, Reels, Stories, IGTV, Carousel, MP3, MP4, JPG, HD, 1080p, 720p, iPhone, iPad, Android, Windows, Mac, Safari, Chrome, Firefox, Edge.
- Keep "#1" and "2026" as-is.
- Output STRICT minified JSON only, no markdown.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(REELS_EN) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`${code}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  let txt = data.choices[0].message.content.trim();
  if (txt.startsWith("```")) txt = txt.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  return JSON.parse(txt);
}

// Replace the `reels: { ... }` block (balanced braces) within a pages.<code>.ts file.
function replaceReelsBlock(src, newJson) {
  const m = src.match(/(["']?)reels\1\s*:/);
  if (!m) throw new Error("reels: not found");
  const startIdx = m.index;
  const keyEnd = startIdx + m[0].length;
  const braceStart = src.indexOf("{", keyEnd);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  // After the closing brace, expect an optional comma — keep it.
  const end = src[i] === "," ? i + 1 : i;
  const indented = JSON.stringify(newJson, null, 2)
    .split("\n").map((l, idx) => idx === 0 ? l : "    " + l).join("\n");
  return src.slice(0, startIdx) + "reels: " + indented + "," + src.slice(end);
}

for (const [code, name] of TARGETS) {
  const file = `src/i18n/pages.${code}.ts`;
  process.stderr.write(`translating ${code}…\n`);
  try {
    const obj = await translate(code, name);
    const cur = await fs.readFile(file, "utf8");
    const next = replaceReelsBlock(cur, obj);
    await fs.writeFile(file, next);
    process.stderr.write(`  patched ${file}\n`);
  } catch (e) {
    process.stderr.write(`FAIL ${code}: ${e.message}\n`);
  }
}
