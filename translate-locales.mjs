// Translate pages.en.ts content into target locales using Lovable AI Gateway.
// Run: node scripts/translate-locales.mjs
import fs from "node:fs/promises";
import path from "node:path";

const KEY = process.env.LOVABLE_API_KEY;
if (!KEY) { console.error("LOVABLE_API_KEY missing"); process.exit(1); }

const TARGETS = [
  ["fr", "French"],
  ["ja", "Japanese"],
  ["ru", "Russian"],
  ["tr", "Turkish"],
  ["vi", "Vietnamese"],
  ["ar", "Arabic"],
  ["th", "Thai"],
  ["it", "Italian"],
  ["pl", "Polish"],
  ["uk", "Ukrainian"],
  ["nl", "Dutch"],
];

// Load and eval-parse the English source as JSON-able object.
const enSrc = await fs.readFile("src/i18n/pages.en.ts", "utf8");
// Strip TS imports/exports and convert to JSON-able JS via dynamic import.
const tmp = `/tmp/pages-en.mjs`;
await fs.writeFile(tmp,
  enSrc
    .replace(/^import[^\n]*\n/gm, "")
    .replace(/export const en: LocaleStrings =/, "export const en =")
);
const { en } = await import(tmp);

async function translate(code, name) {
  const sys = `You are a professional translator for an Instagram downloader website.
Translate ALL human-readable string VALUES of the provided JSON into ${name} (locale code: ${code}).
Rules:
- Keep the exact JSON shape and all keys unchanged.
- Translate ONLY string values. Do NOT translate: keys, URL paths starting with /, HTML tag names, HTML attributes (class, href), brand names "ReelsVideo", "InstaReelsDL", "FastDL", "Instagram", "Reels", "Stories", "IGTV", "MP3", "JPG", "MP4", "HD", "HTTPS".
- Preserve embedded HTML tags like <a href="..." class="...">...</a> exactly; only translate the visible link text.
- Keep numeric tokens (1080p, 320 kbps, 9:16, 24 hours -> localize "hours") natural.
- Output STRICT minified JSON only — no markdown, no commentary.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(en) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${code}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  let txt = data.choices[0].message.content.trim();
  if (txt.startsWith("```")) txt = txt.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(txt);
  return parsed;
}

async function run() {
  for (const [code, name] of TARGETS) {
    const out = `src/i18n/pages.${code}.ts`;
    try { await fs.access(out); console.log(`skip ${code} (exists)`); continue; } catch {}
    console.log(`translating ${code} (${name})…`);
    try {
      const obj = await translate(code, name);
      const ts = `import type { LocaleStrings } from "./types";\n\nexport const ${code === "th" ? "th" : code}: LocaleStrings = ${JSON.stringify(obj, null, 2)};\n`;
      await fs.writeFile(out, ts);
      console.log(`  wrote ${out}`);
    } catch (e) {
      console.error(`FAIL ${code}:`, e.message);
    }
  }
}
run();
