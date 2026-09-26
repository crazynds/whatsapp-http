import ClientModel from "../models/client";

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Sorteio ponderado: cada item carrega um `weight` relativo (não precisa somar 100). */
function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Gera N strings de versão de SO plausíveis, seguindo o esquema de
 * numeração real de cada release. Não é uma lista consultada ao vivo
 * (não temos uma fonte confiável pra isso em runtime), só números dentro
 * de faixas que realmente foram lançadas - é só o terceiro campo do
 * fingerprint (texto de exibição no WhatsApp), não é validado por ele.
 */
function genPointVersions(
  majors: (number | string)[],
  minorMax: number,
  patchMax: number,
  count = 150,
): string[] {
  const versions: string[] = [];
  for (let i = 0; i < count; i++) {
    const major = majors[randomInt(0, majors.length - 1)];
    versions.push(`${major}.${randomInt(0, minorMax)}.${randomInt(0, patchMax)}`);
  }
  return versions;
}
function genWindowsVersions(builds: number[], count = 150): string[] {
  const versions: string[] = [];
  for (let i = 0; i < count; i++) {
    versions.push(`10.0.${builds[randomInt(0, builds.length - 1)]}`);
  }
  return versions;
}

interface BrowserOption {
  name: string;
  weight: number;
}
interface OsProfile {
  os: string;
  weight: number;
  versions: string[];
  browsers: BrowserOption[];
}

// Pesos aproximam a distribuição real de uso desktop (Windows > Mac > Linux;
// Chrome dominante, Safari relevante só no Mac, Edge cresce no Windows,
// Firefox residual em todo lugar). Não precisa ser exato, só relativo.
const OS_PROFILES: OsProfile[] = [
  {
    os: "Windows 11",
    weight: 42,
    versions: genWindowsVersions([22000, 22621, 22631, 22635, 26100, 26200]),
    browsers: [
      { name: "Chrome", weight: 60 },
      { name: "Edge", weight: 30 },
      { name: "Firefox", weight: 10 },
    ],
  },
  {
    os: "Windows 10",
    weight: 24,
    versions: genWindowsVersions([19041, 19042, 19043, 19044, 19045]),
    browsers: [
      { name: "Chrome", weight: 65 },
      { name: "Edge", weight: 22 },
      { name: "Firefox", weight: 13 },
    ],
  },
  {
    os: "Mac OS",
    weight: 20,
    versions: genPointVersions([12, 13, 14, 15], 7, 3),
    browsers: [
      { name: "Safari", weight: 45 },
      { name: "Chrome", weight: 45 },
      { name: "Firefox", weight: 10 },
    ],
  },
  {
    os: "Ubuntu",
    weight: 4,
    versions: genPointVersions(["20.04", "22.04", "24.04"], 6, 0),
    browsers: [
      { name: "Chrome", weight: 55 },
      { name: "Firefox", weight: 45 },
    ],
  },
  {
    os: "Linux Mint",
    weight: 2.5,
    versions: genPointVersions(["21", "21.1", "21.2", "21.3", "22"], 0, 0),
    browsers: [
      { name: "Chrome", weight: 55 },
      { name: "Firefox", weight: 45 },
    ],
  },
  {
    os: "Fedora Linux",
    weight: 2,
    versions: genPointVersions([38, 39, 40, 41], 0, 0),
    browsers: [
      { name: "Chrome", weight: 45 },
      { name: "Firefox", weight: 55 },
    ],
  },
  {
    os: "Debian GNU/Linux",
    weight: 2,
    versions: genPointVersions([11, 12], 0, 0),
    browsers: [
      { name: "Chrome", weight: 45 },
      { name: "Firefox", weight: 55 },
    ],
  },
  {
    os: "Manjaro Linux",
    weight: 1.5,
    versions: genPointVersions([23, 24], randomInt(0, 3), 0),
    browsers: [
      { name: "Chrome", weight: 55 },
      { name: "Firefox", weight: 45 },
    ],
  },
  {
    os: "openSUSE",
    weight: 1,
    versions: genPointVersions(["15.5", "15.6"], 0, 0),
    browsers: [
      { name: "Chrome", weight: 50 },
      { name: "Firefox", weight: 50 },
    ],
  },
  {
    os: "Arch Linux",
    weight: 1,
    versions: genPointVersions(
      ["2024.01.01", "2024.06.01", "2025.01.01", "2025.06.01"],
      0,
      0,
    ),
    browsers: [
      { name: "Chrome", weight: 50 },
      { name: "Firefox", weight: 50 },
    ],
  },
];

/**
 * Sorteia um fingerprint (SO + browser + versão do SO) com pesos que
 * aproximam a distribuição real de uso de SO/browser no mundo real.
 */
function pickRandomBrowser(): [string, string, string] {
  const profile = weightedPick(OS_PROFILES);
  const browser = weightedPick(profile.browsers);
  const osVersion =
    profile.versions[Math.floor(Math.random() * profile.versions.length)];
  return [profile.os, browser.name, osVersion];
}

/**
 * Garante que o client tenha um fingerprint de browser fixo, gravando no
 * banco na primeira vez e reusando dali em diante - cada client sorteia um
 * na primeira conexão e o resultado é persistido em Client.browserFingerprint
 * para ser reusado em toda reconexão (repetir entre clients diferentes não
 * é problema, o que importa é o mesmo client não ficar trocando de "aparelho").
 */
export async function getOrCreateFingerprint(
  clientModel: InstanceType<typeof ClientModel>,
): Promise<[string, string, string]> {
  const storedBrowser = clientModel.get("browserFingerprint") as
    | string
    | null;
  if (storedBrowser) {
    return JSON.parse(storedBrowser);
  }
  const browser = pickRandomBrowser();
  clientModel.set({ browserFingerprint: JSON.stringify(browser) });
  await clientModel.save();
  return browser;
}
