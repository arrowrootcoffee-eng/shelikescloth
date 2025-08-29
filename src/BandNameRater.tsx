import React, { useMemo, useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { RefreshCw } from "lucide-react";
// --- Heuristic helpers ------------------------------------------------------

const DESCRIPTOR_WORDS = [
  "band",
  "project",
  "experience",
  "orchestra",
  "quartet",
  "quintet",
  "trio",
  "ensemble",
  "collective",
  "group",
  "feat",
  "featuring",
  "with",
  "dj",
  "mc",
];

const JUVENILE_WORDS = [
  "taco",
  "unicorn",
  "guacamole",
  "platypus",
  "pickle",
  "pudding",
  "poop",
  "fart",
  "cheetos",
  "yolo",
  "narwhal",
  "rainbow",
  "waffle",
  "nugget",
  "slime",
  "derp",
];

const GENRES = [
  "None",
  "Pop",
  "K-Pop",
  "Indie/Alt",
  "Metal",
  "Math Rock",
  "Rock",
  "Hip Hop",
  "Electronic",
  "Country",
] as const;

type Genre = typeof GENRES[number];

function tokenize(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// --- Personal-name vs two-word band detection ------------------------------

function looksLikePersonalNameStrict(raw: string) {
  const cleaned = raw.trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return false;

  const [w1Raw, w2Raw] = parts;

  // Normalize to ASCII letters only: strip diacritics, hyphens, apostrophes, punctuation
  const normalize = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // remove combining marks
      .replace(/[^A-Za-z]/g, "")
      .toLowerCase();

  const w1 = normalize(w1Raw);
  const w2 = normalize(w2Raw);
  if (!w1 || !w2) return false;

  // Obvious band-y nouns we should NOT treat as surnames
  const GENERIC_NOUN_HINTS = new Set([
    "band","project","group","crew","club","boys","girls","giant","giants",
    "monkeys","fighters","man","men","wizards","wizard","lizard","dragons",
    "vampires","unicorns","blood","wolves","angels","royal","arctic","radio",
    "police","beatles","stones","doors","stripes"
  ]);
  if (GENERIC_NOUN_HINTS.has(w1) || GENERIC_NOUN_HINTS.has(w2)) return false;

  // Expanded first names (batch additions)
  const FIRST_NAMES = new Set([
    "ed","paul","john","george","ringo","james","michael","david","robert",
    "richard","charles","william","thomas","daniel","andrew","mark","anthony",
    "brian","kevin","steven","tim","jack","liam","noah","henry","sam","samuel",
    "luke","harry","lewis","alex","alexander","nathan","scott","bruno","chris",
    "christopher","tyler","chance","taylor","adele","beyonce","lana","billie",
    "olivia","emma","sarah","sara","anna","bella","kate","katie","amy","mary",
    "jane","emily","ella","megan","ariana","selena","kylie",
    // Added per request
    "mariah","jacob","amanda","rae","manny","carrie","jacqueline","jac","saif","mitch","dani"
  ]);

  // Expanded surnames list (batch additions, incl. musician-famous)
  const COMMON_SURNAMES = new Set([
    "sheeran","mccartney","lennon","harrison","starr","presley","cash","hendrix",
    "cobain","morrison","springsteen","grohl","yorke","greenwood","osbourne","osborne",
    "gallagher","turner","flowers","styles","swift","smith","johnson","williams",
    "brown","jones","miller","davis","garcia","rodriguez","martinez","wilson",
    "anderson","thomas","moore","jackson","martin","lee","thompson","white","harris",
    "sanchez","clark","lewis","robinson","walker","young","allen","king","wright",
    "scott","torres","nguyen","hill","flores","green","adams","nelson","baker","hall",
    "rivera","campbell","mitchell","carter","roberts","mars","delrey","knowles",
    "grande","lovato","bieber","eilish","daniels",
    // Added per request
    "carey","dinardo","henson","fair","mullin","mikaelson","gunther","sharayah","sakach"
  ]);

  // Surname prefixes after normalization (o'connor -> oconnor)
  const PREFIXES = ["mc","mac","o","van","von","de","del","di","da","du","la","le","st","saint","bin","ibn","al"];
  const hasPrefix = PREFIXES.some((p) => w2.startsWith(p) && w2.length - p.length >= 2);

  // Surname suffixes (broad but focused)
  const SUFFIXES = [
    "son","sen","ez","es","er","man","mann","ton","ford","field","ham","wood","well",
    "worth","stone","ston","berg","stein","ski","sky","ov","ova","ev","eva","ich","vich",
    "vic","off","eff","ano","ini","tti","ney","cartney","connor","brien","reilly",
    "donald","cain","aine","mars","ley"
  ];
  const hasSuffix = SUFFIXES.some((suf) => w2.endsWith(suf));

  const isFirstLike = FIRST_NAMES.has(w1);
  const isSurnameLike = COMMON_SURNAMES.has(w2) || hasPrefix || hasSuffix;

  return isFirstLike && isSurnameLike;
}

function isTwoWordBandName(raw: string) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 2) return false;
  if (!parts.every((p) => /^[A-Za-z]+$/.test(p))) return false;
  return !looksLikePersonalNameStrict(raw);
}

// --- Descriptor uniqueness after "the" -------------------------------------

function hasTheSandwich(raw: string) {
  return /\b\w+[\w.'-]*\s+the\s+\w+/i.test(raw);
}

function descriptorAfterThe(tokens: string[]) {
  const idx = tokens.indexOf("the");
  if (idx >= 0 && idx + 1 < tokens.length) return tokens[idx + 1];
  return null;
}

const GENERIC_ROLE = new Set([
  "rapper","singer","artist","producer","dj","mc","band","group","man","woman","boy","girl","duo","trio","quartet","collective","project","crew","gang","musician","player","performer","composer","poet","actor","actress"
]);

const CREATIVE_ROLE = new Set([
  "creator","architect","alchemist","visionary","inventor","engineer","scientist","philosopher","prophet","cartographer","navigator","magician","wizard","author","director","designer","artisan","maker","builder"
]);

function descriptorUniquenessBoost(tokens: string[]) {
  const d = descriptorAfterThe(tokens);
  if (!d) return 0;
  const desc = d.toLowerCase();
  if (GENERIC_ROLE.has(desc)) return -0.6; // stronger penalty for generic
  let boost = 0;
  if (CREATIVE_ROLE.has(desc)) boost += 0.9; // slightly stronger for unique
  if (/(or|ist|ian|eer|eur|wright|smith|maker|mancer)$/.test(desc)) boost += 0.5;
  if (desc.length >= 6) boost += 0.2;
  return Math.max(-1.0, Math.min(1.2, Number(boost.toFixed(2))));
}

// --- Penalties: juvenile + randomness + descriptors ------------------------

function juvenilePenalty(tokens: string[]) {
  let hits = 0;
  for (const w of JUVENILE_WORDS) if (tokens.includes(w)) hits++;
  if (!hits) return 0;
  return Math.min(4, 1.0 * hits); // stronger per-hit, higher cap
}

function descriptorPenalty(tokens: string[]) {
  let hits = 0;
  for (const w of DESCRIPTOR_WORDS) if (tokens.includes(w)) hits++;
  return Math.min(4, 1.2 * hits); // stronger overall
}

function randomnessPenalty(raw: string, tokens: string[]) {
  let penalty = 0;
  for (const t of tokens) {
    if (/^[0-9]+$/.test(t)) penalty += 0.8; // pure digits
    if (/[0-9]/.test(t) && /[a-z]/.test(t)) penalty += 0.8; // alpha+digits mix
    if (!/[aeiouy]/.test(t) && /[a-z]/.test(t)) penalty += 1.2; // no vowels
    if (/(?:[^aeiouy\s]){5,}/.test(t)) penalty += 1.0; // long consonant run
    if (t.length <= 2 && /[^a-z]/i.test(t)) penalty += 0.5; // short symbols
  }
  const upper = (raw.match(/[A-Z]/g) || []).length;
  const letters = (raw.match(/[A-Za-z]/g) || []).length;
  if (letters > 0 && upper / letters > 0.7) penalty += 0.5; // shouty caps
  return Math.min(4, Number(penalty.toFixed(2)));
}
// Penalize names that are too long (more than 6 words)
function longNamePenalty(tokens: string[]) {
  const n = tokens.length;
  if (n <= 6) return 0;

  const over = n - 6;
  // Linear ramp: 0.6 per extra word beyond 6 (7 words = 0.6, 8 = 1.2, etc.)
  const penalty = 0.6 * over;

  // Keep style consistent with other penalties: round & cap
  return Math.min(4, Number(penalty.toFixed(2)));
}
// Penalize names that feel semantically odd (e.g., "Maroon 5", "The Black Eyed Peas", "Coldplay")
function nonsensePenalty(raw: string, tokens: string[]) {
  let penalty = 0;

  // Normalize a phrase version for exact phrase checks
  const phrase = tokens.join(" "); // already lowercase if you're using your tokenize()

  // Targeted odd phrases (exact matches, lowercase)
  const ODD_PHRASES = new Set([
    "maroon 5",
    "the black eyed peas",
    "black eyed peas",
    "coldplay"
  ]);
  if (ODD_PHRASES.has(phrase)) penalty += 1.5;

  // Pattern: color + number anywhere (e.g., "maroon 5", "blue 7")
  const COLORS = new Set([
    "black","white","red","blue","green","yellow","purple","pink","orange","maroon","teal","indigo","violet","silver","gold"
  ]);
  const hasColor = tokens.some((t) => COLORS.has(t));
  const hasNumber = tokens.some((t) => /\d/.test(t));
  if (hasColor && hasNumber) penalty += 1.0;

  // Pattern: single-word “weird compound” like "coldplay" (adjective+generic-noun stuck together)
  // Kept narrow to avoid false positives.
  if (tokens.length === 1) {
    const t = tokens[0];
    const prefixAdj = ["cold","blue","black","white","red","green","pink"];
    const suffixNouns = ["play","work","sound","music","thing","stuff"];
    const looksCompound =
      prefixAdj.some((p) => t.startsWith(p)) &&
      suffixNouns.some((s) => t.endsWith(s)) &&
      t.length >= 7; // avoid short coincidences

    if (looksCompound) penalty += 0.8;
  }

  // Keep consistent with your other penalties
  return Math.min(4, Number(penalty.toFixed(2)));
}

// --- Bouba/Kiki + style matching -------------------------------------------

const COLOR_WORDS = new Set(["black", "pink", "red", "blue", "green", "white", "gold", "silver"]);

function boubaKikiBoost(name: string, genre: Genre) {
  const harsh = /[kstzxgrd]/gi; // sharp/stop/fricatives
  const soft = /[mnlwuvbpfh]/gi; // rounded/soft
  const tokens = tokenize(name);

  const harschn = (name.match(harsh)?.length ?? 0);
  const softn = (name.match(soft)?.length ?? 0);

  let boost = 0;

  // Pop/K-Pop: favor soft/round, playful/cute, color pairings, compact names, repeated letters
  if (genre === "Pop" || genre === "K-Pop") {
    if (softn >= harschn) boost += 0.6;
    const hasColors = tokens.some((t) => COLOR_WORDS.has(t));
    if (hasColors && /pink/i.test(name)) boost += 0.6;
    if (name.trim().split(/\s+/).length <= 2) boost += 0.3;
    if (/(.)\1/.test(name)) boost += 0.2;
  }

  // Indie/Alt: rewards "___ the ___" and gentle phonetics
  if (genre === "Indie/Alt") {
    if (hasTheSandwich(name)) boost += 0.6;
    if (softn >= harschn) boost += 0.2;
  }

  // Metal/Rock: prefer harsh phonemes, darker words, longer/weightier looks
  if (genre === "Metal" || genre === "Rock") {
    if (harschn > softn) boost += 0.6;
    if (/(black|doom|blood|void|skull|wrath|masto|mastodon)/i.test(name)) boost += 0.6;
    if (name.replace(/[^a-z]/gi, "").length >= 6) boost += 0.2;
  }

  // Math Rock: numbers, hyphens, geometric/technical vibe
  if (genre === "Math Rock") {
    if (/[0-9]/.test(name)) boost += 0.6;
    if(/[\-_/]/.test(name)) boost += 0.3;
    if ((name.match(/[tkpqxz]/gi)?.length ?? 0) >= 2) boost += 0.4;
  }

  // Hip Hop: short/stylized structures
  if (genre === "Hip Hop") {
    if (/\b(lil|big|yung|young|da|tha)\b/i.test(name)) boost += 0.6;
    if (name.trim().split(/\s+/).length <= 3) boost += 0.2;
  }

  // Electronic: digits/synth cues
  if (genre === "Electronic") {
    if (/[0-9]/.test(name)) boost += 0.4;
    if (/\b(808|909|synth|mono|stereo|electro|wave|bass)\b/i.test(name)) boost += 0.6;
  }

  // Country: places/roads & personal-name tradition
  if (genre === "Country") {
    if (/\b(ridge|creek|hollow|county|road|river|prairie|barn)\b/i.test(name)) boost += 0.6;
    if (looksLikePersonalNameStrict(name)) boost += 0.4;
    if (/\b(&|and)\b/i.test(name)) boost += 0.2;
  }

  return Math.max(-1.5, Math.min(1.8, Number(boost.toFixed(2))));
}

// --- Scoring ----------------------------------------------------------------

function scoreBand(
  raw: string,
  opts: { genre: Genre }
): number {
  const name = raw.trim();
  if (!name) return 0;
  // Special-case override: always 10 for "she likes cloth"
  const normalized = tokenize(name).join(' ');
  if (normalized === 'she likes cloth') return 10;

  // Solo artists using their real name anchor at 5.0 (no boosts/penalties)
  if (looksLikePersonalNameStrict(name)) {
    return 5;
  }

  const tokens = tokenize(name);

  // Separate positive and negative contributions so we can gently amplify positives
  let pos = 0; // positive contributions
  let neg = 0; // negative contributions (penalties)

  // Positive structure/shape bonuses
  if (isTwoWordBandName(name)) pos += 0.4;
  if (hasTheSandwich(name)) pos += 1.5;

  // Descriptor uniqueness can be positive OR negative; split it so negatives aren't scaled
  const descRaw = descriptorUniquenessBoost(tokens);
  if (descRaw >= 0) pos += descRaw; else neg += -descRaw;

  // Style match (bouba/kiki etc.) can also be positive or negative; split it
  const styleRaw = boubaKikiBoost(name, opts.genre);
  if (styleRaw >= 0) pos += styleRaw; else neg += -styleRaw;

  // Extra color-contrast bump for K-Pop/Pop (helps BLACKPINK-like names)
  if ((opts.genre === "K-Pop" || opts.genre === "Pop") && /black\s*?pink/i.test(name.replace(/[^a-z]/gi, ""))) {
    pos += 0.6;
  }

  // Penalties (unchanged)
  neg += descriptorPenalty(tokens);
  neg += juvenilePenalty(tokens);
  neg += randomnessPenalty(name, tokens);
  neg += longNamePenalty(tokens);
  neg += nonsensePenalty(name, tokens);

  // Gentle positive bias without touching negatives
  const POS_MULT = 1.12; // ~+12% to positive attributes
  let score = 5 + POS_MULT * pos - neg;

  return Math.max(0, Math.min(10, Number(score.toFixed(2))));
}

// --- UI ---------------------------------------------------------------------

export default function BandNameRater() {
  const [input, setInput] = useState("");
  const [genre, setGenre] = useState<Genre>("None");
  const [seed, setSeed] = useState(0);

  const score = useMemo(() => scoreBand(input, { genre }), [input, genre, seed]);

  const reset = () => {
    setInput("");
    setGenre("None");
    setSeed((s) => s + 1);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6">
      <div className="max-w-3xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Band Name Rater</h1>
          <Button variant="secondary" onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" /> Reset
          </Button>
        </header>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6 grid gap-4">
            <div className="grid md:grid-cols-[1fr_auto] gap-4 items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a band/artist name…"
                className="h-12 text-lg rounded-xl"
              />
              <div className="text-center md:text-right">
                <div className="text-sm text-neutral-500">Score</div>
                <div className="text-4xl font-bold tabular-nums">{score}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <label className="text-neutral-600">Style match</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as Genre)}
                className="h-10 rounded-md border px-2 bg-white"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6 grid gap-3">
            <div className="flex flex-wrap gap-2">
              {["Taylor Swift","BLACKPINK","Mastodon","Young the Giant","Portugal. The Man","The Taco Unicorns 3000","DJ XJ9QP","Foo Fighters","Arctic Monkeys","Toe-7/8"].map((ex) => (
                <Button key={ex} variant="outline" className="rounded-xl" onClick={() => setInput(ex)}>
                  {ex}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
