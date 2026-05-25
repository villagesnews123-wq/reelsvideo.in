// Retry single failed locale. Usage: node scripts/translate-legal-one.mjs <code> <name>
import fs from "node:fs/promises";

const KEY = process.env.LOVABLE_API_KEY;
const [, , code, name] = process.argv;
if (!KEY || !code || !name) { console.error("usage: node scripts/translate-legal-one.mjs <code> <name>"); process.exit(1); }

const enSrc = await fs.readFile("src/i18n/legal.en.ts", "utf8");
const tmp = `/tmp/legal-en-${code}-${process.pid}.mjs`;
await fs.writeFile(tmp,
  enSrc.replace(/^import[^\n]*\n/gm, "").replace(/export const en: LegalStrings =/, "export const en =")
);
const { en } = await import(tmp);

// Translate one section at a time to keep payloads small.
const SYS = `You translate JSON values into ${name} (locale ${code}).
Rules:
- Translate ONLY string values. Keep the JSON shape and all keys identical.
- Do NOT translate: URL paths starting with /, mailto: addresses, http(s) URLs, HTML tag names, attributes (href, target, rel, class).
- Preserve all HTML tags exactly (<p>, <strong>, <a>, <ul>, <li>) — translate only the visible inner text.
- Keep brand names in English: InstaReelsDL, Instagram, Meta Platforms Inc., Meta Platforms, Inc., FastDL, SnapInsta, SaveFromIns, Google, Google Analytics, Google AdSense, Google Ads Settings, aboutads.info, Reels, Stories, IGTV, MP4, HD, DMCA, iPhone, Android, Windows, Mac, Linux, PC.
- Keep email vilagesnews123@gmail.com unchanged.
- Localize "Last updated: May 2026" naturally.
- Output a SINGLE valid JSON object. Escape every double quote inside string values as \\". Never emit raw unescaped quotes inside HTML attribute values.`;

async function translateChunk(obj) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: JSON.stringify(obj) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json();
  let txt = data.choices[0].message.content.trim();
  if (txt.startsWith("```")) txt = txt.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  return JSON.parse(txt);
}

const out = {};
for (const key of Object.keys(en)) {
  console.log(`  ${code}: ${key}…`);
  let attempt = 0;
  while (true) {
    try { out[key] = await translateChunk(en[key]); break; }
    catch (e) {
      attempt++;
      console.log(`    retry ${attempt}: ${e.message.slice(0, 120)}`);
      if (attempt >= 3) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

const outPath = `src/i18n/legal.${code}.ts`;
const ts = `import type { LegalStrings } from "./legal-types";\n\nexport const ${code}: LegalStrings = ${JSON.stringify(out, null, 2)};\n`;
await fs.writeFile(outPath, ts);
console.log(`wrote ${outPath}`);
