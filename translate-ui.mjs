// Translate the English UI dictionary into all target locales.
// Outputs JSON to stdout for piping into ui.ts.
import fs from "node:fs/promises";

const KEY = process.env.LOVABLE_API_KEY;
if (!KEY) { console.error("LOVABLE_API_KEY missing"); process.exit(1); }

const TARGETS = [
  ["id", "Indonesian"], ["es", "Spanish"], ["fr", "French"], ["ja", "Japanese"],
  ["hi", "Hindi"], ["pt", "Portuguese (Brazil)"], ["ru", "Russian"], ["tr", "Turkish"],
  ["vi", "Vietnamese"], ["ar", "Arabic"], ["th", "Thai"], ["it", "Italian"],
  ["pl", "Polish"], ["uk", "Ukrainian"], ["nl", "Dutch"],
];

const EN = {
  // Trust badges
  noLogin: "No Login Required",
  secure: "100% Secure",
  fast: "Lightning Fast",
  // Important notice
  importantLabel: "Important:",
  importantNotice: "We only support public Instagram content. Please respect creator copyright. See our",
  termsWord: "Terms",
  andWord: "and",
  privacyPolicy: "Privacy Policy",
  // Section headings
  howItWorksPre: "How It Works in",
  howItWorksHighlight: "3 Steps",
  exploreMoreTools: "Explore More Tools",
  frequentlyAskedQuestions: "Frequently Asked Questions",
  // Related footer line
  backTo: "Back to",
  homepageWord: "homepage",
  faqWord: "FAQ",
  contactWord: "Contact",
  // Related labels
  relReels: "Reels Downloader",
  relPhotos: "Photo Downloader",
  relStories: "Story Downloader",
  relMp3: "MP3 / Audio",
  relStoryViewer: "Story Viewer",
  relIgtv: "IGTV Downloader",
  relGuide: "Complete Guide",
  // Downloader
  pasteBtn: "Paste",
  pastePlaceholder: "Paste Instagram link here...",
  downloadWith: "Download with",
  opening: "Opening",
  recommended: "Recommended",
  newTabHint: "A new tab will open with your processed link.",
  fastdlReliable: "FastDL is most reliable right now.",
  clipboardBlocked: "Clipboard access blocked",
  pasteFirst: "Paste an Instagram link first",
  notInstagramLink: "That doesn't look like an Instagram link",
  // Provider tags
  tagFastest: "Fastest • Recommended",
  tagReelsPosts: "Reels & Posts",
  tagUniversal: "Universal Backup",
};

async function translate(code, name) {
  const sys = `You are a professional UI translator for a website that helps users save Instagram videos.
Translate ALL string values of the given JSON into ${name} (locale: ${code}).
Rules:
- Keep the exact JSON shape and all keys unchanged.
- Translate ONLY values. Do NOT translate brand names: Instagram, Reels, Stories, IGTV, MP3, FastDL, ReelsVideo, InstaReelsDL.
- Keep punctuation natural. Keep "•" as is.
- For "downloadWith" / "opening": these are followed by a brand name in code, so output a phrase that reads naturally with the brand appended (e.g. French: "Télécharger avec" / "Ouverture de"). For Japanese, postpositions are fine.
- Output STRICT minified JSON only — no markdown.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(EN) },
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

const out = { en: EN };
for (const [code, name] of TARGETS) {
  process.stderr.write(`translating ${code}…\n`);
  try {
    out[code] = await translate(code, name);
  } catch (e) {
    process.stderr.write(`FAIL ${code}: ${e.message}\n`);
    out[code] = EN;
  }
}
await fs.writeFile("/tmp/ui-translations.json", JSON.stringify(out, null, 2));
process.stderr.write("wrote /tmp/ui-translations.json\n");
