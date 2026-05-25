// Translate legal.en.ts into all other locales using Lovable AI Gateway.
// Run: node scripts/translate-legal.mjs
import fs from "node:fs/promises";

const KEY = process.env.LOVABLE_API_KEY;
if (!KEY) { console.error("LOVABLE_API_KEY missing"); process.exit(1); }

const TARGETS = [
  ["id", "Indonesian"], ["es", "Spanish"], ["fr", "French"], ["ja", "Japanese"],
  ["hi", "Hindi"], ["pt", "Portuguese (Brazil)"], ["ru", "Russian"], ["tr", "Turkish"],
  ["vi", "Vietnamese"], ["ar", "Arabic"], ["th", "Thai"], ["it", "Italian"],
  ["pl", "Polish"], ["uk", "Ukrainian"], ["nl", "Dutch"],
];

// Load English legal source as JSON-able.
const enSrc = await fs.readFile("src/i18n/legal.en.ts", "utf8");
const tmp = `/tmp/legal-en.mjs`;
await fs.writeFile(tmp,
  enSrc
    .replace(/^import[^\n]*\n/gm, "")
    .replace(/export const en: LegalStrings =/, "export const en =")
);
const { en } = await import(tmp);

const SYS = (name, code) => `You are a professional translator for an Instagram downloader website's legal/info pages.
Translate ALL human-readable string VALUES of the provided JSON into ${name} (locale code: ${code}).
Rules:
- Keep the exact JSON shape and all keys unchanged.
- Translate ONLY string values. Do NOT translate: keys, URL paths starting with /, mailto: addresses, http(s) URLs, HTML tag names, HTML attributes (href, target, rel, class).
- Preserve embedded HTML tags exactly (<p>, <strong>, <a>, <ul>, <li>, etc.) — translate only the visible text inside them.
- Keep brand names in English: "InstaReelsDL", "Instagram", "Meta Platforms Inc.", "Meta Platforms, Inc.", "FastDL", "SnapInsta", "SaveFromIns", "Google", "Google Analytics", "Google AdSense", "Google Ads Settings", "aboutads.info", "Reels", "Stories", "IGTV", "MP4", "HD", "DMCA", "iPhone", "Android", "Windows", "Mac", "Linux", "PC".
- Keep email "vilagesnews123@gmail.com" unchanged.
- Localize "Last updated: May 2026" naturally.
- Output STRICT minified JSON only — no markdown fences, no commentary.`;

async function translate(code, name) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS(name, code) + "\nReturn a single valid JSON object. Escape all double quotes inside string values as \\\". Never emit raw unescaped quotes inside HTML attribute values." },
        { role: "user", content: JSON.stringify(en) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${code}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  let txt = data.choices[0].message.content.trim();
  if (txt.startsWith("```")) txt = txt.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  return JSON.parse(txt);
}

for (const [code, name] of TARGETS) {
  const out = `src/i18n/legal.${code}.ts`;
  try { await fs.access(out); console.log(`skip ${code}`); continue; } catch {}
  console.log(`translating ${code} (${name})…`);
  try {
    const obj = await translate(code, name);
    const ts = `import type { LegalStrings } from "./legal-types";\n\nexport const ${code}: LegalStrings = ${JSON.stringify(obj, null, 2)};\n`;
    await fs.writeFile(out, ts);
    console.log(`  wrote ${out}`);
  } catch (e) {
    console.error(`FAIL ${code}:`, e.message);
  }
}
