type Flavor = {
  key: string;
  label: string;
  copy: string;
};

const DRAWINGS: Record<string, string> = {
  tiger: `
    <ellipse cx="390" cy="1610" rx="200" ry="170" />
    <circle cx="320" cy="1450" r="58" />
    <circle cx="462" cy="1450" r="58" />
    <circle cx="390" cy="1270" r="170" />
    <circle cx="330" cy="1190" r="34" />
    <circle cx="450" cy="1190" r="34" />
    <path d="M310 1266c60 56 110 56 160 0" />
    <path d="M358 1312h66" />
    <path d="M260 1720c35 60 62 110 80 150" />
    <path d="M520 1720c-35 60 -62 110 -80 150" />
    <path d="M170 820c60 -55 140 -90 220 -90s160 35 220 90" />
    <path d="M120 2020h540" />
    <path d="M205 2020c-20 70 -45 130 -72 175" />
    <path d="M575 2020c20 70 45 130 72 175" />
  `,
  playground: `
    <ellipse cx="390" cy="1610" rx="200" ry="170" />
    <circle cx="320" cy="1450" r="58" />
    <circle cx="462" cy="1450" r="58" />
    <circle cx="390" cy="1270" r="170" />
    <path d="M290 1260c70 62 130 62 200 0" />
    <path d="M360 1320h60" />
    <path d="M104 880c40 -60 112 -86 176 -64" />
    <path d="M506 816c67 -18 134 10 180 72" />
    <path d="M560 1700v-420" />
    <path d="M560 1280l120 120" />
    <path d="M560 1280l-120 120" />
    <path d="M680 1400v290" />
    <path d="M680 1690h-118" />
    <path d="M150 2080c80 -10 150 -10 220 0" />
    <path d="M360 2080c80 -10 150 -10 220 0" />
  `,
  farm: `
    <rect x="180" y="1320" width="420" height="420" rx="18" />
    <path d="M150 1320l240 -180 240 180" />
    <rect x="332" y="1520" width="116" height="220" rx="40" />
    <path d="M104 1900h572" />
    <path d="M120 2080c82 -20 170 -20 250 0" />
    <path d="M405 2080c82 -20 170 -20 250 0" />
    <circle cx="186" cy="1140" r="66" />
    <circle cx="254" cy="1090" r="66" />
    <circle cx="322" cy="1140" r="66" />
    <circle cx="540" cy="980" r="72" />
    <ellipse cx="560" cy="1660" rx="120" ry="90" />
    <circle cx="510" cy="1600" r="32" />
    <circle cx="610" cy="1600" r="32" />
  `,
  rainbow: `
    <path d="M120 1360c80 -250 220 -380 420 -380s340 130 420 380" />
    <path d="M170 1360c65 -205 185 -312 370 -312s305 107 370 312" />
    <path d="M220 1360c50 -160 150 -244 320 -244s270 84 320 244" />
    <ellipse cx="390" cy="1820" rx="200" ry="180" />
    <circle cx="390" cy="1550" r="170" />
    <path d="M292 1555c62 58 134 58 196 0" />
    <circle cx="326" cy="1490" r="32" />
    <circle cx="456" cy="1490" r="32" />
    <path d="M110 2140h560" />
  `,
  hero: `
    <circle cx="390" cy="1170" r="210" />
    <ellipse cx="390" cy="1660" rx="250" ry="260" />
    <path d="M288 1160c70 74 140 74 210 0" />
    <circle cx="320" cy="1092" r="34" />
    <circle cx="460" cy="1092" r="34" />
    <path d="M238 1640c-20 180 -32 290 -42 390" />
    <path d="M542 1640c20 180 32 290 42 390" />
    <path d="M210 1472c-110 62 -150 118 -180 188" />
    <path d="M570 1472c110 62 150 118 180 188" />
    <path d="M120 2140h540" />
  `,
  garden: `
    <ellipse cx="390" cy="1660" rx="200" ry="180" />
    <circle cx="390" cy="1390" r="170" />
    <path d="M310 1405c55 48 105 48 160 0" />
    <circle cx="332" cy="1328" r="28" />
    <circle cx="448" cy="1328" r="28" />
    <path d="M162 1950c20 -150 70 -268 140 -360" />
    <path d="M618 1950c-20 -150 -70 -268 -140 -360" />
    <path d="M130 2140h520" />
    <path d="M190 2140c-24 -70 -52 -122 -86 -160" />
    <path d="M590 2140c24 -70 52 -122 86 -160" />
    <circle cx="168" cy="1860" r="34" />
    <circle cx="614" cy="1860" r="34" />
  `,
  loading: `
    <path d="M250 1260c96 -120 186 -140 290 -140s194 20 290 140" stroke-dasharray="26 24" />
    <path d="M190 1570c120 -80 240 -110 360 -110s240 30 360 110" stroke-dasharray="18 20" />
    <path d="M132 1900c174 -90 344 -120 518 -120s344 30 518 120" transform="translate(-520 0)" stroke-dasharray="10 18" />
    <circle cx="390" cy="1620" r="120" stroke-dasharray="24 22" />
  `
};

export function pickFlavor(prompt: string): Flavor {
  const lower = prompt.toLowerCase();

  if (lower.includes("farm")) {
    return {
      key: "farm",
      label: "Barnyard friends",
      copy: "I turned it into a roomy farm scene with thick, easy-to-color outlines."
    };
  }

  if (lower.includes("rainbow")) {
    return {
      key: "rainbow",
      label: "Rainbow parade",
      copy: "I added a simple rainbow and kept the lines open and easy to color."
    };
  }

  if (lower.includes("bigger") || lower.includes("center")) {
    return {
      key: "hero",
      label: "Centered hero pose",
      copy: "I made the main character bigger and moved it to the center."
    };
  }

  return {
    key: "garden",
    label: "Garden sketch",
    copy: "Here’s a fresh version with simple shapes and clean cartoon outlines."
  };
}

export function createLineArtDataUrl(variant: string) {
  const art = DRAWINGS[variant] ?? DRAWINGS.garden;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="794" height="1123">
      <rect width="794" height="1123" rx="36" fill="#fdfaf2" />
      <rect x="34" y="34" width="726" height="1055" rx="28" fill="#fffdf6" stroke="#5d4438" stroke-width="8" />
      <g fill="none" stroke="#2f241f" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
        ${art}
      </g>
      <g fill="none" stroke="#dcb36b" stroke-width="6" opacity="0.7">
        <path d="M120 240h140" />
        <path d="M534 180h110" />
        <path d="M180 920h94" />
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
