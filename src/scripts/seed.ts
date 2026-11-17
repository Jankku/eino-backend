/* oxlint-disable unicorn/no-null -- NULL is a value the seed deliberately stores. */
// Fills a development database with varied data that reaches every field's limits.
// Usage: `npm run seed -- [options]`, see `npm run seed -- --help`.
//
// Every seeded user's name starts with `seed_` and every seeded bulletin id with `5eed5eed`,
// so a rerun replaces only seeded data and `--clean` removes it.
import * as fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import monitor from 'pg-monitor';
import type { ITask } from 'pg-promise';
import sharp from 'sharp';
import { config } from '../config.ts';
import { db, pgp } from '../db/config.ts';
import { auditAction, type AuditAction } from '../db/audit.ts';
import { bookStatuses, type BookStatus } from '../db/model/bookstatus.ts';
import { movieStatuses, type MovieStatus } from '../db/model/moviestatus.ts';
import { bulletinConditions, bulletinTypes } from '../db/bulletins.ts';
import { languageCodes } from '../util/languages.ts';
import { generatePasswordHash } from '../util/password.ts';
import { createProfilePictureDir, generateProfilePicturePath } from '../util/profilepicture.ts';
import { removeShareImage } from '../util/share.ts';
import { Logger, logError } from '../util/logger.ts';

const USERNAME_PREFIX = 'seed_';
const BULLETIN_ID_PREFIX = '5eed5eed';
const TOTP_SECRET = 'SEEDSEEDSEEDSEEDSEEDSEEDSEEDSEED';

// Limits from the API schemas and the database columns.
const MAX_STRING = 255;
const MAX_NOTE = 10_000;
const MAX_URL = 2048;
const MAX_INT = 2_147_483_647;
const INSERT_CHUNK = 1000;

const { values: args } = parseArgs({
  options: {
    users: { type: 'string', default: '40' },
    items: { type: 'string', default: '300' },
    heavy: { type: 'string', default: '10000' },
    audits: { type: 'string', default: '5000' },
    seed: { type: 'string', default: '1' },
    password: { type: 'string', default: process.env.SEED_PASSWORD ?? 'Seed-Password-2026!' },
    clean: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

const usage = `Seeds the development database. Existing seed data is replaced, other data is kept.

  --users <n>      Random users besides the fixed ones (default 40)
  --items <n>      Maximum books and movies per random user (default 300)
  --heavy <n>      Books and movies for seed_heavy, capped at USER_LIST_ITEM_MAX_COUNT (default 10000)
  --audits <n>     Audit log rows (default 5000)
  --seed <n>       Random seed, the same seed produces the same data (default 1)
  --password <pw>  Password of every seed user (default SEED_PASSWORD or Seed-Password-2026!)
  --clean          Only remove seed data
`;

const toCount = (name: string, value: string) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return number;
};

// ---------------------------------------------------------------------------
// Randomness

const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

let random = createRandom(1);

const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const chance = (probability: number) => random() < probability;
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

// Picks a generator by weight, so rare shapes stay rare in bulk data.
const weighted = <T>(entries: readonly (readonly [number, () => T])[]): T => {
  const total = entries.reduce((sum, [weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [weight, generate] of entries) {
    roll -= weight;
    if (roll < 0) return generate();
  }
  return entries.at(-1)![1]();
};

const uuid = () => {
  const full = Array.from({ length: 32 }, () => int(0, 15).toString(16));
  full[12] = '4';
  full[16] = pick(['8', '9', 'a', 'b']);
  const value = full.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (min: number, max: number) => new Date(now - (int(min * 24, max * 24) * DAY) / 24);

// ---------------------------------------------------------------------------
// Strings

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
Repeats text until it is exactly `length` UTF-16 code units, which is how the API counts.
Graphemes are never split, so the last few units are padded with ASCII when needed.
*/
const fill = (text: string, length: number, separator = ' ') => {
  let result = '';
  while (result.length < length) {
    for (const { segment } of segmenter.segment(result ? separator + text : text)) {
      if (result.length + segment.length > length) {
        return result + 'x'.repeat(length - result.length);
      }
      result += segment;
    }
  }
  return result;
};

const truncate = (text: string, length: number) => {
  let result = '';
  for (const { segment } of segmenter.segment(text)) {
    if (result.length + segment.length > length) break;
    result += segment;
  }
  return result;
};

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

// Comma-separated, so the lists stay compact and the formatter leaves them alone.
const list = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const adjectives = list(`
  silent, crimson, forgotten, endless, hidden, broken, golden, last, northern, quiet, burning,
  little, secret, wild, distant, hollow, electric, midnight, ancient, bitter, blind, bright,
  brave, cold, cruel, dark, dead, deep, drowned, dying, early, eastern, empty, eternal, false,
  fallen, final, first, frozen, gentle, glass, glorious, grey, green, haunted, heavy, holy,
  impossible, invisible, iron, lonely, long, lost, lucky, mad, marble, merciful, missing,
  modern, naked, nameless, narrow, new, nocturnal, old, open, painted, pale, paper, perfect,
  poisoned, private, radiant, red, restless, rising, royal, rusty, sacred, savage,
  scarlet, second, shattered, short, silver, sleeping, slow, small, southern, stolen, strange,
  sudden, sunken, sweet, tender, thin, tiny, true, twisted, uncertain, unfinished, velvet,
  violet, wandering, warm, western, white, wicked, wooden, wounded, yellow, young
`);

const nouns = list(`
  river, kingdom, garden, machine, winter, house, sea, empire, letter, storm, island, mirror,
  forest, city, shadow, orchard, signal, harbour, lake, archive, angel, apple, atlas, autumn,
  bell, bird, blood, bone, book, bridge, brother, candle, castle, cathedral, child, clock,
  cloud, coast, compass, country, crown, daughter, desert, door, dragon, dream, dust, earth,
  echo, engine, evening, father, feather, field, fire, flower, fog, fortress, fox, frontier,
  ghost, glacier, god, heart, highway, hill, horizon, hour, hunter, ice, journey, key, king,
  labyrinth, lantern, library, light, lighthouse, lion, map, market, memory, mill, moon,
  morning, mother, mountain, museum, music, night, ocean, palace, path, prophet, queen, rain,
  road, rose, ruin, sailor, salt, season, silence, sister, sky, snow, soldier, song, spring,
  star, station, stone, stranger, summer, sun, sword, tide, tower, train, tree, valley,
  village, voice, wall, war, water, wave, well, wind, window, wolf, word, world
`);

const finnishWords = list(`
  järvi, sydän, yö, kesä, tähti, metsä, äiti, pöllö, lumi, syksy, saari, tuntematon, sotilas,
  kevät, hääyö, myrsky, tyttö, öljy, ystävä, kirja, aamu, aalto, enkeli, haavoittunut, hämärä,
  ilta, isä, jää, joki, kaupunki, kello, kettu, kivi, koti, kuningas, kuolema, kuu, kylä,
  laiva, lapsi, lintu, lohikäärme, luoto, maa, meri, muisto, mökki, neito, noita, nälkä,
  onni, poika, puu, pääsky, rakkaus, ranta, routa, ruusu, saaristo, sade, salaisuus, sammakko,
  satama, savu, sielu, sisar, sota, suo, susi, sumu, talo, talvi, taivas, tie, tuli, tuuli,
  tähtitaivas, uni, unohdus, valo, varjo, veli, vesi, vuori, vuosi, väki, ääni, äänetön,
  ikkuna, kirjasto, kesäyö, kalevala, sisu, saunailta, revontulet, peikko, metsästäjä
`);

const firstNames = list(`
  Aino, Väinö, Matti, Siiri, Jane, Haruki, Chimamanda, Gabriel, Olga, Ngũgĩ, Zoë, José,
  Søren, Björk, Łukasz, Ömer, François, Ana, Mikhail, Wisława, Aleksis, Eeva, Elina, Helmi,
  Ilmari, Juhani, Kaarina, Katja, Leena, Minna, Mika, Pentti, Rosa, Sofi, Tove, Tuomas,
  Ulla, Veikko, Aleksandr, Anna, Astrid, Ayşe, Benedict, Bilal, Camille, Chen, Clarice,
  Dag, Dmitri, Elena, Elif, Emily, Ernest, Esther, Fatima, Fernando, Fyodor, Gustave, Hanna,
  Hilary, Hiroshi, Ingrid, Isabel, Italo, Jhumpa, Jorge, Julio, Kazuo, Kenzaburō, Leo,
  Liu, Lucía, Magnus, Mahmoud, Mai, Margaret, Mariana, Maya, Mei, Milan, Naguib, Nadia,
  Nikolai, Oksana, Orhan, Pablo, Patrick, Priya, Rabindranath, Ryū, Salman, Sami, Sara,
  Shirley, Siddhartha, Svetlana, Takashi, Tomás, Toni, Ursula, Valeria, Virginia, Vladimir,
  Yasunari, Yuki, Zadie, Zhang, Ólafur, Þóra, Émile, Ève
`);

const lastNames = list(`
  Virtanen, Korhonen, Mäkelä, Murakami, Adichie, García Márquez, Tokarczuk, Pamuk,
  Dostoyevsky, Lindgren, Kivi, Jansson, Le Guin, O'Connor, van der Berg, Nguyễn, Ångström,
  Øvergaard, Müller, Szymborska, Nieminen, Mäkinen, Hämäläinen, Laine, Heikkinen, Koskinen,
  Järvinen, Lehtonen, Lehtinen, Saarinen, Salminen, Heinonen, Niemi, Kinnunen, Salonen,
  Turunen, Salo, Laitinen, Tuominen, Rantanen, Karjalainen, Jokinen, Mattila, Savolainen,
  Lahtinen, Ahonen, Waltari, Linna, Södergran, Sillanpää, Oksanen, Statovci, Tervo,
  Achebe, Allende, Atwood, Austen, Baldwin, Borges, Bulgakov, Calvino, Camus, Cortázar,
  Dickens, Eco, Ferrante, Flaubert, Hesse, Hugo, Ishiguro, Kafka, Kawabata, Lessing,
  Lispector, Mahfouz, Mann, McCarthy, Morrison, Nabokov, Ōe, Orwell, Rushdie, Saramago,
  Sebald, Smith, Tagore, Tolstoy, Tolkien, Undset, Woolf, Yu Hua, Zola, Kim, Lee, Park,
  Wang, Li, Tanaka, Suzuki, Yamamoto, Hernández, Rodríguez, Pérez, Kowalski, Nowak, Novák,
  Horváth, Yılmaz, Kaya, Ivanova, Petrov, Jensen, Hansen, Andersson, Johansson, Ólafsdóttir,
  De Luca, d'Arcy, Mac an tSaoir, Al-Sayed, Ben-David, Fitzgerald-Smythe
`);

const publishers = list(`
  WSOY, Otava, Gummerus, Tammi, Like, Penguin Random House, HarperCollins, Hachette,
  Macmillan, Simon & Schuster, Shinchōsha, Kodansha, Gallimard, Suhrkamp, Bonnier, Teos,
  Siltala, Atena, Johnny Kniga, Karisto, Into, Basam Books, Aula & Co, Docendo, Sammakko,
  Kosmos, Schildts & Söderströms, Gaudeamus, Vastapaino, Avain, Readme.fi, Moreeni,
  Bazar, Minerva, Art House, Nemo, Kustantamo S&S, Albert Bonniers Förlag, Norstedts,
  Gyldendal, Cappelen Damm, Aschehoug, Rowohlt, Fischer, Hanser, Diogenes, Flammarion,
  Actes Sud, Seuil, Albin Michel, Anagrama, Alfaguara, Feltrinelli, Einaudi, Mondadori,
  Companhia das Letras, Shūeisha, Bungeishunjū, Kadokawa, Iwanami Shoten, Minumsa,
  Changbi, Faber & Faber, Bloomsbury, Vintage, Picador, Granta, Canongate, Scribner,
  Knopf, Farrar Straus and Giroux, W. W. Norton, Little Brown, Orbit, Tor, Del Rey, DAW,
  Gollancz, Baen, Oxford University Press, Cambridge University Press, MIT Press,
  O'Reilly Media, Manning, No Starch Press, Pragmatic Bookshelf, Wiley, Springer, Pearson,
  Taschen, Phaidon, Lonely Planet, DK, Usborne, Scholastic, Puffin, Viz Media, Yen Press,
  Dark Horse, Image Comics, Marvel, DC Comics, Self-published, Independently published
`);

const studios = list(`
  Solar Films, Yellow Film & TV, Bufo, Aamu Film Company, Studio Ghibli, A24, Pixar,
  Warner Bros., Universal Pictures, Toho, Pathé, Gaumont, Zentropa, Studio Canal, Neon,
  Searchlight Pictures, Blumhouse, Laika, Fisher King, Making Movies, Tuffi Films,
  Helsinki-filmi, Elokuvayhtiö Oy Suomi-Filmi, Suomen Filmiteollisuus, Production House,
  Citizen Jane Productions, Sputnik, Matila Röhr Productions, Walt Disney Pictures,
  Paramount Pictures, Columbia Pictures, 20th Century Studios, Lionsgate, MGM,
  DreamWorks Pictures, DreamWorks Animation, Illumination, Legendary Pictures,
  New Line Cinema, Focus Features, Miramax, Annapurna Pictures, Plan B Entertainment,
  Amblin Entertainment, Lucasfilm, Marvel Studios, Netflix, Amazon MGM Studios, Apple TV+,
  HBO Films, BBC Film, Film4, Working Title Films, Aardman Animations, Ealing Studios,
  Constantin Film, UFA, X Filme, Studio Babelsberg, EuropaCorp, Le Pacte, Wild Bunch,
  Svensk Filmindustri, Nordisk Film, Memfis Film, Cattleya, Rai Cinema, El Deseo,
  Mosfilm, Lenfilm, Shochiku, Nikkatsu, Kadokawa, Toei Animation, Madhouse,
  Kyoto Animation, Production I.G, Sunrise, CJ Entertainment, Showbox, Shaw Brothers,
  Golden Harvest, China Film Group, Yash Raj Films, Dharma Productions, Red Chillies,
  Cinemascópio, Warp Films, Ghost House Pictures, Troma, Hammer Films, Cannon Films,
  Carolco Pictures, Orion Pictures, Castle Rock, Village Roadshow, Weta FX
`);

const loremWords = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut ' +
  'labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris ' +
  'nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse'
).split(' ');

// Scripts, directions and code points that UIs often render, sort or measure wrong.
const scriptSamples = [
  '吾輩は猫である。名前はまだ無い。',
  '红楼梦 · 三国演义 · 西游记',
  '채식주의자와 소년이 온다',
  'مئة عام من العزلة',
  'סיפור על אהבה וחושך',
  'Война и мир. Преступление и наказание',
  'Η Οδύσσεια του Ομήρου',
  'गोदान और गबन की कहानी',
  'ข้างหลังภาพเป็นนวนิยายที่ไม่มีการเว้นวรรค',
  'Tuntematon sotilas – Väinö Linna’s «klassikko»',
  'Ærøskøbing Ångström Œuvre Straße ı İ ß ŉ',
  '👩‍👩‍👧‍👦 🏳️‍🌈 🇫🇮 🧑🏽‍🚀 👍🏿 ❤️‍🔥',
  'Z̴̡̛̩̤̈́͌a̸̢̛͎̠͂l̵̢̰̓g̷̱̿o̶̡̍ ̷̙̈t̸̰̀e̵̬͝x̴̹̌t̷̲̿',
  'English \u202Edesrever\u202C with an RTL override',
  'zero\u200Bwidth\u200Bspaces\u200Band\u00ADsoft\u00ADhyphens',
  '𝔉𝔯𝔞𝔨𝔱𝔲𝔯 𝕯𝖔𝖚𝖇𝖑𝖊-𝖘𝖙𝖗𝖚𝖈𝖐 𝒮𝒸𝓇𝒾𝓅𝓉',
];

// Text that is valid input but looks like markup, code or placeholders.
const trickySamples = [
  '<script>alert("xss")</script>',
  '<b>bold</b> &amp; <i>italic</i> &lt;tag&gt;',
  '**markdown** _emphasis_ `code` [link](https://example.com)',
  "Robert'); DROP TABLE books;--",
  '${title} {{author}} %s %d %n',
  'null',
  'undefined',
  'NaN',
  '0',
  '-1',
  'true',
  '   ',
  'line one\nline two\r\nline three',
  '\ttabbed\tvalue\t',
  '../../../etc/passwd',
  'https://example.com/not-a-link-but-looks-like-one',
  String.raw`C:\Windows\System32`,
  '😀',
  'A',
  'ÄÖÅ äöå',
];

const realisticTitle = () =>
  weighted([
    [4, () => `The ${capitalize(pick(adjectives))} ${capitalize(pick(nouns))}`],
    [3, () => `${capitalize(pick(nouns))} of the ${capitalize(pick(nouns))}`],
    [2, () => `${pick(firstNames)}'s ${capitalize(pick(nouns))}`],
    [3, () => capitalize(`${pick(finnishWords)} ja ${pick(finnishWords)}`)],
    [1, () => `${capitalize(pick(adjectives))} ${capitalize(pick(nouns))}: Part ${int(1, 12)}`],
    [1, () => `${capitalize(pick(nouns))} ${int(1, 2000)}`],
    [1, () => capitalize(pick(finnishWords))],
  ]);

const personName = () =>
  weighted([
    [10, () => `${pick(firstNames)} ${pick(lastNames)}`],
    [2, () => `${pick(firstNames)} ${pick(lastNames)}, ${pick(firstNames)} ${pick(lastNames)}`],
    [1, () => `${pick(firstNames).charAt(0)}. ${pick(lastNames)}`],
    [1, () => pick(lastNames)],
  ]);

const unbrokenWord = () => fill('Pneumonoultramicroscopicsilicovolcanoconiosis', MAX_STRING, '');

// Gives a field its realistic value most of the time and an extreme one otherwise.
const fixedString = (realistic: () => string, extremeRate = 0.15) => {
  if (!chance(extremeRate)) return realistic();
  return weighted([
    [3, () => ''],
    [2, () => pick(['A', 'Ö', '1', '😀', '.'])],
    [5, () => fill(`${realistic()} ${pick(loremWords)}`, MAX_STRING)],
    [3, unbrokenWord],
    [5, () => pick(scriptSamples)],
    [2, () => fill(pick(scriptSamples), MAX_STRING)],
    [4, () => pick(trickySamples)],
    [1, () => `  ${realistic()}  `],
  ]);
};

const sentence = () => {
  const words = Array.from({ length: int(4, 18) }, () => pick(loremWords));
  return `${capitalize(words.join(' '))}.`;
};

const paragraph = () => Array.from({ length: int(2, 7) }, sentence).join(' ');

const longNote = (length: number) => {
  let note = '';
  while (note.length < length) {
    note += (note ? '\n\n' : '') + paragraph();
  }
  return truncate(note, length);
};

const markdownNote = () =>
  [
    '# Thoughts',
    '',
    `**Rating:** ${int(0, 10)}/10 — _${sentence()}_`,
    '',
    `- ${sentence()}`,
    `- ${sentence()}`,
    '  - nested item',
    '',
    '> A quote that goes on for a while. ' + sentence(),
    '',
    '```',
    'const code = "block";',
    '```',
    '<details><summary>HTML</summary><img src=x onerror=alert(1)></details>',
  ].join('\n');

const note = (extremeRate = 0.1): string | null =>
  weighted([
    [40, () => null],
    [4, () => ''],
    [30, sentence],
    [15, paragraph],
    [10 * extremeRate, () => longNote(MAX_NOTE)],
    [10 * extremeRate, () => longNote(int(1000, MAX_NOTE))],
    [10 * extremeRate, () => fill(unbrokenWord(), MAX_NOTE, '')],
    [10 * extremeRate, () => fill(pick(scriptSamples), MAX_NOTE, '\n')],
    [10 * extremeRate, markdownNote],
    [10 * extremeRate, () => '\n\n\n' + sentence() + '\n\n\n'],
  ]);

const isbn13 = () => {
  const digits = [9, 7, pick([8, 9]), ...Array.from({ length: 9 }, () => int(0, 9))];
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
  return [...digits, (10 - (sum % 10)) % 10].join('');
};

const isbn10 = () => {
  const digits = Array.from({ length: 9 }, () => int(0, 9));
  const sum = digits.reduce((total, digit, index) => total + digit * (10 - index), 0);
  const check = (11 - (sum % 11)) % 11;
  return digits.join('') + (check === 10 ? 'X' : String(check));
};

const isbn = () =>
  weighted([
    [50, isbn13],
    [15, isbn10],
    [10, () => isbn13().replace(/^(\d{3})(\d)(\d{3})(\d{5})(\d)$/, '$1-$2-$3-$4-$5')],
    [15, () => ''],
    [3, () => fill('978-0-00-000000-0', MAX_STRING)],
    [3, () => pick(trickySamples)],
    [2, () => 'ISBN ' + isbn13()],
  ]);

const imageUrl = (portrait: boolean, extremeRate = 0.15): string | null => {
  const [width, height] = portrait ? [300, 450] : [450, 300];
  const seed = int(1, 1_000_000);
  return weighted([
    [30, () => null],
    [5, () => ''],
    [40, () => `https://picsum.photos/seed/${seed}/${width}/${height}`],
    [15, () => `https://covers.openlibrary.org/b/id/${int(1_000_000, 12_000_000)}-L.jpg`],
    [20 * extremeRate, () => `https://picsum.photos/seed/${seed}/1600/200`],
    [20 * extremeRate, () => `https://picsum.photos/seed/${seed}/200/1600`],
    [10 * extremeRate, () => `https://picsum.photos/seed/${seed}/8/8`],
    [10 * extremeRate, () => `https://picsum.photos/seed/${seed}/4000/6000`],
    [20 * extremeRate, () => 'https://example.invalid/missing-cover.jpg'],
    [10 * extremeRate, () => 'http://picsum.photos/id/1/300/450'],
    [
      10 * extremeRate,
      () =>
        `https://picsum.photos/seed/${seed}/${width}/${height}?q=${fill('a', 2000, '')}`.slice(
          0,
          MAX_URL,
        ),
    ],
  ]);
};

const language = () =>
  weighted<string | null>([
    [25, () => null],
    [30, () => 'en'],
    [25, () => 'fi'],
    [5, () => pick(['sv', 'de', 'fr', 'ja', 'es', 'ru'])],
    [5, () => pick(languageCodes)],
  ]);

const positiveInt = (realistic: () => number, extremeRate = 0.05) =>
  chance(extremeRate)
    ? weighted([
        [3, () => 0],
        [2, () => 1],
        [3, () => int(10_000, 1_000_000)],
        [1, () => MAX_INT],
      ])
    : realistic();

const year = (extremeRate = 0.05) =>
  chance(extremeRate)
    ? weighted([
        [3, () => 0],
        [2, () => int(1, 1500)],
        [2, () => int(2030, 9999)],
        [1, () => MAX_INT],
      ])
    : weighted([
        [8, () => int(1990, 2026)],
        [3, () => int(1900, 1989)],
        [1, () => int(1600, 1899)],
      ]);

const score = () =>
  weighted([
    [3, () => 0],
    [10, () => int(1, 10)],
    [10, () => int(6, 9)],
  ]);

type DatePair = { start_date: Date; end_date: Date };

const datesFor = (createdOn: Date, status: string, extremeRate = 0.03): DatePair => {
  if (chance(extremeRate)) {
    return weighted<DatePair>([
      [3, () => ({ start_date: daysAgo(10, 400), end_date: daysAgo(500, 900) })],
      [
        1,
        () => ({
          start_date: new Date('0001-01-01T00:00:00Z'),
          end_date: new Date('0001-01-01T00:00:00Z'),
        }),
      ],
      [1, () => ({ start_date: new Date(now), end_date: new Date('9999-12-31T23:59:59Z') })],
      [
        1,
        () => ({
          start_date: new Date('1970-01-01T00:00:00Z'),
          end_date: new Date('2038-01-19T03:14:08Z'),
        }),
      ],
    ]);
  }
  const start = new Date(createdOn.getTime() + int(0, 30) * DAY);
  if (status === 'planned') return { start_date: createdOn, end_date: createdOn };
  const end = new Date(Math.min(start.getTime() + int(0, 120) * DAY, now));
  return { start_date: start, end_date: status === 'completed' ? end : start };
};

// ---------------------------------------------------------------------------
// Rows

type BookRow = {
  book_id: string;
  user_id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  image_url: string | null;
  pages: number;
  year: number;
  language_code: string | null;
  note: string | null;
  status: BookStatus;
  score: number;
} & DatePair & { created_on: Date };

type MovieRow = {
  movie_id: string;
  user_id: string;
  title: string;
  studio: string;
  director: string;
  writer: string;
  image_url: string | null;
  duration: number;
  year: number;
  note: string | null;
  status: MovieStatus;
  score: number;
} & DatePair & { created_on: Date };

const bookStatus = () =>
  weighted<BookStatus>([
    [45, () => 'completed'],
    [10, () => 'reading'],
    [8, () => 'on-hold'],
    [7, () => 'dropped'],
    [30, () => 'planned'],
  ]);

const movieStatus = () =>
  weighted<MovieStatus>([
    [50, () => 'completed'],
    [8, () => 'watching'],
    [7, () => 'on-hold'],
    [5, () => 'dropped'],
    [30, () => 'planned'],
  ]);

const randomBook = (userId: string, createdOn: Date, extremeRate: number): BookRow => {
  const status = bookStatus();
  return {
    book_id: uuid(),
    user_id: userId,
    isbn: isbn(),
    title: fixedString(realisticTitle, extremeRate),
    author: fixedString(personName, extremeRate),
    publisher: fixedString(() => pick(publishers), extremeRate),
    image_url: imageUrl(true, extremeRate),
    pages: positiveInt(() => int(40, 1200), extremeRate / 3),
    year: year(extremeRate / 3),
    language_code: language(),
    note: note(extremeRate),
    status,
    score: status === 'planned' && chance(0.8) ? 0 : score(),
    ...datesFor(createdOn, status, extremeRate / 5),
    created_on: createdOn,
  };
};

const randomMovie = (userId: string, createdOn: Date, extremeRate: number): MovieRow => {
  const status = movieStatus();
  return {
    movie_id: uuid(),
    user_id: userId,
    title: fixedString(realisticTitle, extremeRate),
    studio: fixedString(() => pick(studios), extremeRate),
    director: fixedString(personName, extremeRate),
    writer: fixedString(personName, extremeRate),
    image_url: imageUrl(true, extremeRate),
    duration: positiveInt(() => int(70, 200), extremeRate / 3),
    year: year(extremeRate / 3),
    note: note(extremeRate),
    status,
    score: status === 'planned' && chance(0.8) ? 0 : score(),
    ...datesFor(createdOn, status, extremeRate / 5),
    created_on: createdOn,
  };
};

// Every extreme value in every field at least once, cycling the values so they combine.
const edgeStrings = () => [
  '',
  'A',
  '😀',
  fill('Long title with many ordinary words that keeps going', MAX_STRING),
  unbrokenWord(),
  fill('Ä', MAX_STRING, ''),
  fill('👩‍👩‍👧‍👦', MAX_STRING, ''),
  ...scriptSamples,
  ...scriptSamples.map((sample) => fill(sample, MAX_STRING)),
  ...trickySamples,
  'Same title',
  'same title',
  'Same Title',
  'Ääkköset ensin',
  'Zebra',
  'zebra',
  'Ångström',
  '10 items',
  '2 items',
  '100 items',
  '#1 hashtag first',
  '"Quoted"',
  '(Parenthesised)',
];

const edgeNumbers = [
  0,
  1,
  2,
  9,
  10,
  99,
  100,
  999,
  1000,
  9999,
  10_000,
  65_535,
  1_000_000,
  MAX_INT - 1,
  MAX_INT,
];

const edgeDates: DatePair[] = [
  { start_date: new Date('0001-01-01T00:00:00Z'), end_date: new Date('0001-01-01T00:00:00Z') },
  { start_date: new Date('9999-12-31T23:59:59Z'), end_date: new Date('9999-12-31T23:59:59Z') },
  { start_date: new Date('1970-01-01T00:00:00Z'), end_date: new Date('1969-12-31T23:59:59Z') },
  { start_date: new Date('2038-01-19T03:14:07Z'), end_date: new Date('2038-01-19T03:14:08Z') },
  { start_date: new Date('2024-02-29T23:30:00Z'), end_date: new Date('2024-03-01T00:30:00Z') },
  { start_date: new Date('2025-12-31T22:00:00Z'), end_date: new Date('2026-01-01T02:00:00Z') },
  { start_date: daysAgo(1, 1), end_date: daysAgo(100, 100) },
  { start_date: new Date(now), end_date: new Date(now) },
];

const edgeNotes = () => [
  null,
  '',
  ' ',
  '\n',
  longNote(MAX_NOTE),
  fill(unbrokenWord(), MAX_NOTE, ''),
  fill('👩‍👩‍👧‍👦', MAX_NOTE, ''),
  ...scriptSamples.map((sample) => fill(sample, MAX_NOTE, '\n')),
  markdownNote(),
  ...trickySamples,
];

const edgeImages = (seed: number) => [
  null,
  '',
  `https://picsum.photos/seed/${seed}/300/450`,
  `https://picsum.photos/seed/${seed}/1600/200`,
  `https://picsum.photos/seed/${seed}/200/1600`,
  `https://picsum.photos/seed/${seed}/8/8`,
  `https://picsum.photos/seed/${seed}/4000/6000`,
  'https://example.invalid/missing-cover.jpg',
  'https://picsum.photos/404/not-an-image',
  'http://picsum.photos/id/1/300/450',
  `https://picsum.photos/seed/${seed}/300/450?q=${fill('a', MAX_URL, '')}`.slice(0, MAX_URL),
];

const at = <T>(items: readonly T[], index: number): T => items[index % items.length];

const edgeBooks = (userId: string): BookRow[] => {
  const strings = edgeStrings();
  const notes = edgeNotes();
  const languages = [null, ...languageCodes];
  const count = Math.max(strings.length, notes.length, languages.length, edgeDates.length) + 20;
  return Array.from({ length: count }, (_, i) => {
    const status = at(bookStatuses, i);
    return {
      book_id: uuid(),
      user_id: userId,
      isbn: at(['', isbn13(), isbn10(), fill('9', MAX_STRING, ''), ...trickySamples], i),
      // The last 20 share a title to show how ties sort and paginate.
      title: i >= count - 20 ? 'Duplicate title' : at(strings, i),
      author: at(strings, i + 1),
      publisher: at(strings, i + 2),
      image_url: at(edgeImages(i), i),
      pages: at(edgeNumbers, i),
      year: at(edgeNumbers, i + 3),
      language_code: at(languages, i),
      note: at(notes, i),
      status,
      score: i % 11,
      ...at(edgeDates, i),
      created_on: i % 5 === 0 ? new Date(now - DAY) : daysAgo(0, 3000),
    };
  });
};

const edgeMovies = (userId: string): MovieRow[] => {
  const strings = edgeStrings();
  const notes = edgeNotes();
  const count = Math.max(strings.length, notes.length, edgeDates.length) + 20;
  return Array.from({ length: count }, (_, i) => {
    const status = at(movieStatuses, i);
    return {
      movie_id: uuid(),
      user_id: userId,
      title: i >= count - 20 ? 'Duplicate title' : at(strings, i),
      studio: at(strings, i + 1),
      director: at(strings, i + 2),
      writer: at(strings, i + 3),
      image_url: at(edgeImages(i), i + 1),
      duration: at(edgeNumbers, i),
      year: at(edgeNumbers, i + 3),
      note: at(notes, i + 1),
      status,
      score: (i + 5) % 11,
      ...at(edgeDates, i + 1),
      created_on: i % 5 === 0 ? new Date(now - DAY) : daysAgo(0, 3000),
    };
  });
};

// ---------------------------------------------------------------------------
// Users

type SeedUser = {
  user_id: string;
  username: string;
  email: string | null;
  email_verified_on: Date | null;
  role: 'admin' | 'basic';
  created_on: Date;
  last_login_on: Date | null;
  disabled_on: Date | null;
  totp_enabled_on: Date | null;
  profile_picture: 'generate' | 'missing' | null;
  books: number | 'edge';
  movies: number | 'edge';
  description: string;
};

const fixedUsers = (heavy: number): Omit<SeedUser, 'user_id'>[] => {
  const base = {
    email: null,
    email_verified_on: null,
    role: 'basic',
    created_on: daysAgo(400, 1500),
    last_login_on: daysAgo(0, 10),
    disabled_on: null,
    totp_enabled_on: null,
    profile_picture: null,
  } as const;
  const verified = (name: string) => ({
    email: `${name}@example.com`,
    email_verified_on: daysAgo(100, 300),
  });
  return [
    {
      ...base,
      ...verified('admin'),
      username: 'seed_admin',
      role: 'admin',
      profile_picture: 'generate',
      books: 25,
      movies: 25,
      description: 'Admin with a few items',
    },
    {
      ...base,
      ...verified('basic'),
      username: 'seed_basic',
      profile_picture: 'generate',
      books: 150,
      movies: 150,
      description: 'Typical user',
    },
    {
      ...base,
      username: 'seed_empty',
      created_on: new Date(now - 60_000),
      last_login_on: null,
      books: 0,
      movies: 0,
      description: 'No items, never logged in',
    },
    {
      ...base,
      ...verified('heavy'),
      username: 'seed_heavy',
      books: heavy,
      movies: heavy,
      description: 'Many items, for performance',
    },
    {
      ...base,
      ...verified('edge'),
      username: 'seed_edge',
      profile_picture: 'missing',
      books: 'edge',
      movies: 'edge',
      description: 'Every extreme value in every field; picture file missing',
    },
    {
      ...base,
      ...verified('totp'),
      username: 'seed_totp',
      totp_enabled_on: daysAgo(5, 50),
      books: 10,
      movies: 10,
      description: `2FA enabled, secret ${TOTP_SECRET}`,
    },
    {
      ...base,
      ...verified('disabled'),
      username: 'seed_disabled',
      disabled_on: daysAgo(1, 20),
      books: 30,
      movies: 30,
      description: 'Disabled account',
    },
    {
      ...base,
      email: 'unverified@example.com',
      username: 'seed_unverified',
      books: 5,
      movies: 0,
      description: 'Unverified email',
    },
    {
      ...base,
      email: 'unverified@example.com',
      username: 'seed_unverified_twin',
      books: 0,
      movies: 5,
      description: 'Shares an unverified email',
    },
    {
      ...base,
      email: fill('seed.max', MAX_STRING - '@example.com'.length - 1, '.') + 'x@example.com',
      email_verified_on: daysAgo(10, 20),
      username: fill('seed_maximum_length_username', MAX_STRING, '_'),
      books: 20,
      movies: 20,
      description: 'Username and email at 255 characters',
    },
    {
      ...base,
      username: 'seed_ユーザー名_🦊_👩‍👩‍👧‍👦',
      profile_picture: 'generate',
      books: 15,
      movies: 15,
      description: 'CJK and emoji username',
    },
    { ...base, username: 'seed_مستخدم_עברית', books: 15, movies: 15, description: 'RTL username' },
    {
      ...base,
      username: 'seed_<script>alert(1)</script>',
      books: 5,
      movies: 5,
      description: 'Markup in username',
    },
    {
      ...base,
      username: 'seed_spaces   inside   name',
      books: 5,
      movies: 5,
      description: 'Repeated spaces in username',
    },
    {
      ...base,
      username: 'seed_ÄÖÅ_Zalgo_Z̴̡̛̩̤̈́͌a̸̢̛͎̠͂l̵̢̰̓',
      books: 5,
      movies: 5,
      description: 'Diacritics and combining marks',
    },
    {
      ...base,
      username: 'seed_old_timer',
      created_on: new Date('2000-01-01T00:00:00Z'),
      last_login_on: new Date('2000-01-02T00:00:00Z'),
      books: 60,
      movies: 60,
      description: 'Registered in 2000, anniversary bulletins',
    },
  ];
};

const randomUsers = (count: number, maxItems: number): Omit<SeedUser, 'user_id'>[] =>
  Array.from({ length: count }, (_, i) => {
    const name = `seed_user_${String(i + 1).padStart(4, '0')}`;
    const hasEmail = chance(0.6);
    const itemCount = () =>
      weighted([
        [3, () => 0],
        [6, () => int(1, Math.min(20, maxItems))],
        [3, () => int(0, maxItems)],
      ]);
    return {
      username: chance(0.15)
        ? truncate(`${name}_${fixedString(personName, 1).replaceAll('@', '')}`, MAX_STRING).trim()
        : name,
      email: hasEmail ? `${name}@example.org` : null,
      email_verified_on: hasEmail && chance(0.7) ? daysAgo(1, 300) : null,
      role: weighted([
        [1, () => 'admin' as const],
        [15, () => 'basic' as const],
      ]),
      created_on: daysAgo(0, 2500),
      last_login_on: chance(0.85) ? daysAgo(0, 400) : null,
      disabled_on: chance(0.08) ? daysAgo(0, 100) : null,
      totp_enabled_on: chance(0.1) ? daysAgo(0, 100) : null,
      profile_picture: chance(0.3) ? 'generate' : null,
      books: itemCount(),
      movies: itemCount(),
      description: '',
    };
  });

const pictureColors = ['#e63946', '#2a9d8f', '#e9c46a', '#264653', '#8338ec', '#ff006e', '#3a86ff'];

// Profile pictures are always stored as 300x300 AVIF by the upload handler.
const createProfilePicture = async (username: string) => {
  const initial = [...segmenter.segment(username.slice(USERNAME_PREFIX.length))][0]?.segment ?? '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <rect width="300" height="300" fill="${pick(pictureColors)}"/>
    <text x="150" y="190" font-size="140" font-family="sans-serif" fill="#fff" text-anchor="middle">${initial.replaceAll(/[<>&"]/g, '')}</text>
  </svg>`;
  const picturePath = generateProfilePicturePath();
  await fs.writeFile(picturePath, await sharp(Buffer.from(svg)).avif().toBuffer());
  return picturePath;
};

// ---------------------------------------------------------------------------
// Bulletins and audits

const bulletins = (users: SeedUser[]) => {
  const active = { start_date: daysAgo(1, 5), end_date: new Date(now + 30 * DAY) };
  const userIds = users
    .filter((user) => ['seed_basic', 'seed_edge'].includes(user.username))
    .map((user) => user.user_id);
  let index = 0;
  const id = () => `${BULLETIN_ID_PREFIX}-0000-4000-8000-${String(++index).padStart(12, '0')}`;
  return [
    {
      id: id(),
      title: 'Scheduled maintenance',
      message: 'Eino is unavailable on Sunday 02:00–04:00 UTC.',
      name: 'seed-maintenance',
      type: 'info',
      visibility: 'public',
      condition: null,
      ...active,
      userIds: [],
    },
    {
      id: id(),
      title: 'Short',
      message: null,
      name: null,
      type: 'success',
      visibility: 'public',
      condition: null,
      ...active,
      userIds: [],
    },
    {
      id: id(),
      title: fill('A very long bulletin title that keeps going', 500),
      message: longNote(5000),
      name: 'seed-long',
      type: 'warning',
      visibility: 'authenticated',
      condition: null,
      ...active,
      userIds: [],
    },
    {
      id: id(),
      title: unbrokenWord(),
      message: fill(unbrokenWord(), 2000, ''),
      name: 'seed-unbroken',
      type: 'error',
      visibility: 'authenticated',
      condition: null,
      ...active,
      userIds: [],
    },
    {
      id: id(),
      title: '<script>alert("bulletin")</script>',
      message: markdownNote(),
      name: 'seed-markup',
      type: 'error',
      visibility: 'authenticated',
      condition: null,
      ...active,
      userIds: [],
    },
    {
      id: id(),
      title: scriptSamples[3],
      message: scriptSamples[4],
      name: 'seed-rtl',
      type: 'info',
      visibility: 'authenticated',
      condition: null,
      ...active,
      userIds: [],
    },
    {
      id: id(),
      title: 'Only for selected users',
      message: 'You should see this as seed_basic or seed_edge.',
      name: 'seed-user',
      type: 'success',
      visibility: 'user',
      condition: null,
      ...active,
      userIds,
    },
    ...bulletinConditions.map((condition) => ({
      id: id(),
      title: `Condition: ${condition}`,
      message: `Shown when ${condition.replaceAll('_', ' ')}.`,
      name: `seed-${condition}`,
      type: 'warning',
      visibility: 'condition',
      condition,
      ...active,
      userIds: [],
    })),
    {
      id: id(),
      title: 'Expired bulletin',
      message: 'Should not be shown.',
      name: 'seed-expired',
      type: 'info',
      visibility: 'public',
      condition: null,
      start_date: daysAgo(60, 90),
      end_date: daysAgo(10, 30),
      userIds: [],
    },
    {
      id: id(),
      title: 'Future bulletin',
      message: 'Should not be shown yet.',
      name: 'seed-future',
      type: 'info',
      visibility: 'public',
      condition: null,
      start_date: new Date(now + 10 * DAY),
      end_date: new Date(now + 20 * DAY),
      userIds: [],
    },
    ...Array.from({ length: 30 }, () => ({
      id: id(),
      title: realisticTitle(),
      message: chance(0.5) ? sentence() : null,
      name: null,
      type: pick(bulletinTypes),
      visibility: 'public',
      condition: null,
      start_date: daysAgo(400, 800),
      end_date: daysAgo(100, 399),
      userIds: [],
    })),
  ];
};

const auditActions = Object.values(auditAction);
const failureReasons = [
  'invalid_credentials',
  'invalid_otp',
  'expired_token',
  'rate_limited',
  'account_disabled',
  'insufficient_role',
];

const auditRows = (count: number, users: SeedUser[], books: BookRow[]) =>
  Array.from({ length: count }, () => {
    const user = pick(users);
    const action: AuditAction = pick(auditActions);
    const actor = { actor_user_id: user.user_id, username: user.username };
    const base = {
      ...actor,
      action,
      table_name: null as string | null,
      record_id: null as string | null,
      old_data: null as unknown,
      new_data: null as unknown,
      created_on: daysAgo(0, 730),
    };
    if (action === 'create' || action === 'update' || action === 'delete') {
      const book = books.length > 0 ? pick(books) : randomBook(user.user_id, new Date(), 0.2);
      const { book_id, user_id: _userId, ...data } = book;
      const changed = { ...data, title: fixedString(realisticTitle, 0.3), score: score() };
      return {
        ...base,
        table_name: 'books',
        record_id: book_id,
        old_data: action === 'create' ? null : data,
        new_data: action === 'delete' ? null : changed,
      };
    }
    if (action.endsWith('_failed') || action === 'authorization_denied') {
      // Unauthenticated failures have no actor, so record the target to find them on cleanup.
      return {
        ...base,
        ...(chance(0.7) ? { actor_user_id: null, username: null } : actor),
        table_name: 'users',
        record_id: user.user_id,
        new_data: {
          operation: 'login',
          reason: pick(failureReasons),
          source_ip: `203.0.113.${int(1, 254)}`,
          method: 'POST',
          suppressed_attempts: chance(0.8) ? 0 : int(1, 5000),
        },
      };
    }
    return { ...base, new_data: chance(0.5) ? { detail: fixedString(sentence, 0.3) } : null };
  });

// ---------------------------------------------------------------------------
// Database

const userColumns = new pgp.helpers.ColumnSet(
  [
    'user_id',
    'username',
    'password',
    'email',
    'email_verified_on',
    'last_login_on',
    'created_on',
    'role_id',
    'role_modified_on',
    'disabled_on',
    'totp_enabled_on',
    'profile_picture_path',
  ],
  { table: 'users' },
);
const bookColumns = new pgp.helpers.ColumnSet(
  [
    'book_id',
    'user_id',
    'isbn',
    'title',
    'author',
    'publisher',
    'image_url',
    'pages',
    'year',
    'language_code',
    'created_on',
  ],
  { table: 'books' },
);
const bookListColumns = new pgp.helpers.ColumnSet(
  ['book_id', 'status', 'score', 'note', 'start_date', 'end_date', 'created_on'],
  { table: 'user_book_list' },
);
const movieColumns = new pgp.helpers.ColumnSet(
  [
    'movie_id',
    'user_id',
    'title',
    'studio',
    'director',
    'writer',
    'image_url',
    'duration',
    'year',
    'created_on',
  ],
  { table: 'movies' },
);
const movieListColumns = new pgp.helpers.ColumnSet(
  ['movie_id', 'status', 'score', 'note', 'start_date', 'end_date', 'created_on'],
  { table: 'user_movie_list' },
);
const auditColumns = new pgp.helpers.ColumnSet(
  [
    'actor_user_id',
    'username',
    'action',
    'table_name',
    'record_id',
    { name: 'old_data', mod: ':json' },
    { name: 'new_data', mod: ':json' },
    'created_on',
  ],
  { table: 'audit_log' },
);

type ColumnSet = InstanceType<typeof pgp.helpers.ColumnSet>;

// pg-promise formats dates in local time, which turns 9999-12-31Z into year 10000 east of UTC.
const isoDates = (row: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );

const insertChunks = async (t: ITask<unknown>, rows: object[], ...columnSets: ColumnSet[]) => {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK).map((row) => isoDates(row));
    for (const columns of columnSets) {
      await t.none(pgp.helpers.insert(chunk, columns));
    }
  }
};

const clean = async () => {
  const seedUsers = await db.any<{ user_id: string; profile_picture_path: string | null }>(
    String.raw`SELECT user_id, profile_picture_path FROM users WHERE username LIKE 'seed\_%'`,
  );
  const userIds = seedUsers.map((user) => user.user_id);
  await db.tx('seedClean', async (t) => {
    if (userIds.length > 0) {
      await t.none(
        'DELETE FROM audit_log WHERE actor_user_id IN ($1:csv) OR record_id IN ($1:csv)',
        [userIds],
      );
      await t.none('DELETE FROM users WHERE user_id IN ($1:csv)', [userIds]);
    }
    await t.none('DELETE FROM bulletins WHERE id::text LIKE $1', [`${BULLETIN_ID_PREFIX}%`]);
  });
  for (const user of seedUsers) {
    await removeShareImage(user.user_id);
    if (user.profile_picture_path) await fs.rm(user.profile_picture_path, { force: true });
  }
  return seedUsers.length;
};

const seed = async () => {
  // Logging every generated insert would bury the summary.
  if (monitor.isAttached()) monitor.detach();
  if (config.isProduction) {
    throw new Error('Refusing to seed a production database');
  }
  if (args.help) {
    process.stdout.write(usage);
    return;
  }

  const removed = await clean();
  Logger.info(`Removed ${removed} seed users`);
  if (args.clean) return;

  const userCount = toCount('users', args.users);
  const maxItems = Math.min(toCount('items', args.items), config.USER_LIST_ITEM_MAX_COUNT);
  const heavy = Math.min(toCount('heavy', args.heavy), config.USER_LIST_ITEM_MAX_COUNT);
  const auditCount = toCount('audits', args.audits);
  random = createRandom(toCount('seed', args.seed));

  const started = Date.now();
  const roles = await db.many<{ id: number; name: string }>('SELECT id, name FROM roles');
  const roleId = (name: string) => roles.find((role) => role.name === name)!.id;
  const passwordHash = await generatePasswordHash(args.password);
  await createProfilePictureDir();

  const users: SeedUser[] = [...fixedUsers(heavy), ...randomUsers(userCount, maxItems)].map(
    (user) => ({ ...user, user_id: uuid() }),
  );
  const userRows: object[] = [];
  for (const user of users) {
    const picture =
      user.profile_picture === 'generate'
        ? await createProfilePicture(user.username)
        : user.profile_picture === 'missing'
          ? generateProfilePicturePath()
          : null;
    userRows.push({
      ...user,
      password: passwordHash,
      role_id: roleId(user.role),
      role_modified_on: user.created_on,
      profile_picture_path: picture,
    });
  }

  let bookTotal = 0;
  let movieTotal = 0;
  await db.tx('seed', async (t) => {
    await insertChunks(t, userRows, userColumns);

    const totpUsers = users.filter((user) => user.totp_enabled_on);
    if (totpUsers.length > 0) {
      await t.none(
        pgp.helpers.insert(
          totpUsers.map((user) =>
            isoDates({
              user_id: user.user_id,
              type: '2fa',
              target: user.username,
              secret: TOTP_SECRET,
              algorithm: 'SHA1',
              digits: 6,
              period: 30,
              created_on: user.totp_enabled_on,
            }),
          ),
          ['user_id', 'type', 'target', 'secret', 'algorithm', 'digits', 'period', 'created_on'],
          'verifications',
        ),
      );
    }

    const sampleBooks: BookRow[] = [];
    for (const user of users) {
      // The heavy user gets fewer extremes so sorting and filtering stay realistic.
      const extremeRate = user.username === 'seed_heavy' ? 0.03 : 0.15;
      // Every tenth item shares a timestamp to exercise tie-breaking in created_on pagination.
      const tied = daysAgo(0, 365);
      const ageDays = Math.max(1, Math.floor((now - user.created_on.getTime()) / DAY));
      const createdOn = (index: number) => (index % 10 === 0 ? tied : daysAgo(0, ageDays));
      const books = user.books === 'edge' ? edgeBooks(user.user_id) : [];
      const movies = user.movies === 'edge' ? edgeMovies(user.user_id) : [];
      if (typeof user.books === 'number') {
        for (let i = 0; i < user.books; i++)
          books.push(randomBook(user.user_id, createdOn(i), extremeRate));
      }
      if (typeof user.movies === 'number') {
        for (let i = 0; i < user.movies; i++)
          movies.push(randomMovie(user.user_id, createdOn(i), extremeRate));
      }
      await insertChunks(t, books, bookColumns, bookListColumns);
      await insertChunks(t, movies, movieColumns, movieListColumns);
      bookTotal += books.length;
      movieTotal += movies.length;
      if (sampleBooks.length < 1000) sampleBooks.push(...books.slice(0, 50));
    }

    for (const bulletin of bulletins(users)) {
      const { userIds, ...row } = bulletin;
      await t.none(pgp.helpers.insert(isoDates(row), Object.keys(row), 'bulletins'));
      for (const userId of userIds) {
        await t.none('INSERT INTO bulletin_users (bulletin_id, user_id) VALUES ($1, $2)', [
          row.id,
          userId,
        ]);
      }
    }

    const audits = auditRows(auditCount, users, sampleBooks);
    for (let i = 0; i < audits.length; i += INSERT_CHUNK) {
      const ids = await t.map(
        pgp.helpers.insert(
          audits.slice(i, i + INSERT_CHUNK).map((row) => isoDates(row)),
          auditColumns,
        ) + ' RETURNING id',
        [],
        (row: { id: number }) => row.id,
      );
      // Seeded history must never reach the Discord webhook.
      await t.none('DELETE FROM discord_audit_queue WHERE audit_id IN ($1:csv)', [ids]);
    }
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  Logger.info(
    `Seeded ${users.length} users, ${bookTotal} books, ${movieTotal} movies and ${auditCount} audits in ${seconds}s`,
  );
  Logger.info(`Every seed user's password is ${args.password}`);
  for (const user of users.filter((user) => user.description)) {
    Logger.info(
      `  ${truncate(user.username, 60)}${user.username.length > 60 ? '…' : ''} (${user.role}): ${user.description}`,
    );
  }
  Logger.info(`TOTP: otpauth://totp/Eino:seed_totp?secret=${TOTP_SECRET}&issuer=Eino`);
};

try {
  await seed();
} catch (error) {
  logError(error);
  process.exitCode = 1;
} finally {
  pgp.end();
}
