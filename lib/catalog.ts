export type PlaybackSource = {
  type: "mp4" | "hls" | "orbis";
  src?: string;
  prompt?: string;
};

export type Artwork = {
  image?: string;
  gradient: string;
  accent: string;
  motif: "orb" | "horizon" | "prism" | "rings" | "grid" | "flare";
};

export type Title = {
  id: string;
  name: string;
  eyebrow?: string;
  tagline: string;
  description: string;
  year: number;
  rating: string;
  runtime: string;
  match: number;
  genres: string[];
  cast: string[];
  badge?: string;
  /** Attribution shown with the title (licensed footage). */
  credit?: string;
  /** This title carries the live "Ad That Listens" break. */
  adBreak?: boolean;
  progress?: number;
  artwork: Artwork;
  playback: PlaybackSource;
};

const bigBuckBunny =
  "https://archive.org/download/BBB-1080Pp/1080.ia.mp4";

const sampleVideo =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const titles: Title[] = [
  {
    id: "big-buck-bunny",
    name: "Big Buck Bunny",
    eyebrow: "A BLENDER FOUNDATION FILM",
    tagline: "Three bullies. One very large rabbit.",
    description:
      "A gentle giant of a rabbit wakes to a perfect spring morning, until three forest rodents start picking on the smallest creatures in the meadow. Patience, it turns out, has its limits.",
    year: 2008,
    rating: "G",
    runtime: "10m",
    match: 98,
    genres: ["Animation", "Comedy", "Family"],
    cast: ["Big Buck Bunny", "Frank", "Rinky", "Gimera"],
    badge: "#1 in Films Today",
    credit: "© Blender Foundation · peach.blender.org · CC BY 3.0",
    adBreak: true,
    artwork: {
      image: "/art/big-buck-bunny.jpg",
      gradient:
        "radial-gradient(circle at 70% 30%, #f6e7a1 0, #9fc46a 22%, transparent 48%), linear-gradient(120deg, #0d1a0c 6%, #2f5a26 50%, #6f9a3e 100%)",
      accent: "#f6e7a1",
      motif: "horizon",
    },
    playback: { type: "mp4", src: bigBuckBunny },
  },
  {
    id: "monument-valley",
    name: "Monument Valley",
    tagline: "Some roads remember you.",
    description:
      "A drifter crossing a desert highway finds a town that appears on no map—and a past that refuses to stay buried.",
    year: 2025,
    rating: "TV-MA",
    runtime: "8 episodes",
    match: 96,
    genres: ["Drama", "Neo-Western", "Mystery"],
    cast: ["June Hale", "Roman Kade", "Tess Amari"],
    badge: "New Series",
    progress: 63,
    artwork: {
      image: "/art/monument-valley.jpg",
      gradient:
        "linear-gradient(178deg, transparent 46%, #190e09 47%), radial-gradient(circle at 64% 28%, #ffb968 0, #ca674d 21%, #311523 66%)",
      accent: "#ffb968",
      motif: "horizon",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
  {
    id: "neon-runner",
    name: "Neon Runner",
    tagline: "Outrun the city. Outlive the night.",
    description:
      "A courier with one forbidden package has ninety minutes to cross a city where every camera knows her face.",
    year: 2026,
    rating: "R",
    runtime: "1h 39m",
    match: 94,
    genres: ["Action", "Cyberpunk", "Crime"],
    cast: ["Mika Tan", "Dante Cole", "Inez Park"],
    badge: "Recently Added",
    artwork: {
      image: "/art/neon-runner.jpg",
      gradient:
        "radial-gradient(circle at 72% 42%, #ed4f99 0, transparent 13%), linear-gradient(128deg, #09051e 5%, #32207a 45%, #036c83 100%)",
      accent: "#f250a0",
      motif: "grid",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
  {
    id: "the-deepest-room",
    name: "The Deepest Room",
    tagline: "There is always another door.",
    description:
      "A celebrated architect wakes inside a building that rearranges itself whenever she closes her eyes.",
    year: 2024,
    rating: "TV-14",
    runtime: "6 episodes",
    match: 91,
    genres: ["Psychological", "Drama", "Suspense"],
    cast: ["Nora Vale", "Theo Mercer", "Aya Lin"],
    artwork: {
      image: "/art/the-deepest-room.jpg",
      gradient:
        "radial-gradient(circle at 51% 18%, #a69bbf 0, transparent 22%), linear-gradient(140deg, #050608, #262b3a 45%, #0a0a0c)",
      accent: "#b9acd3",
      motif: "prism",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
  {
    id: "afterlight",
    name: "Afterlight",
    tagline: "Morning never came.",
    description:
      "Stranded in a coastal city beneath a permanent sunset, five strangers discover that daylight has a price.",
    year: 2026,
    rating: "TV-MA",
    runtime: "10 episodes",
    match: 97,
    genres: ["Fantasy", "Ensemble", "Drama"],
    cast: ["Amelia Grey", "Jon Bell", "Samira Moss"],
    badge: "Top 10",
    progress: 27,
    artwork: {
      image: "/art/afterlight.jpg",
      gradient:
        "radial-gradient(ellipse at 70% 82%, #f6a45f 0, #bd4d45 26%, transparent 52%), linear-gradient(120deg, #11172d, #312541 60%, #17101b)",
      accent: "#f6a45f",
      motif: "rings",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
  {
    id: "white-noise-club",
    name: "White Noise Club",
    tagline: "Everybody is listening.",
    description:
      "Four obsessive sound designers uncover a frequency hidden inside the world's most-streamed song.",
    year: 2025,
    rating: "TV-14",
    runtime: "45m",
    match: 89,
    genres: ["Documentary", "Music", "Conspiracy"],
    cast: ["Luca Stern", "Bea Quinn", "Rafi Stone"],
    artwork: {
      image: "/art/white-noise-club.jpg",
      gradient:
        "linear-gradient(118deg, #090909, #252525 55%, #8d1e25), repeating-linear-gradient(90deg, transparent 0 12px, #fff1 12px 13px)",
      accent: "#f0f0e8",
      motif: "flare",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
  {
    id: "glass-ocean",
    name: "Glass Ocean",
    tagline: "Beautiful things break first.",
    description:
      "A marine biologist follows a crystalline tide toward an island absent from every nautical chart.",
    year: 2023,
    rating: "PG-13",
    runtime: "2h 04m",
    match: 93,
    genres: ["Adventure", "Nature", "Sci-Fi"],
    cast: ["Lea Farrow", "Noah Reed", "Emi Watan"],
    progress: 81,
    artwork: {
      image: "/art/glass-ocean.jpg",
      gradient:
        "radial-gradient(circle at 58% 55%, #82ecdf 0, transparent 21%), linear-gradient(135deg, #031721, #064d68 50%, #2a9a9b)",
      accent: "#82ecdf",
      motif: "prism",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
  {
    id: "paper-kingdom",
    name: "Paper Kingdom",
    tagline: "Fold the world your way.",
    description:
      "Two sisters inherit a bookshop whose stories can rewrite one hour of real life every midnight.",
    year: 2025,
    rating: "PG",
    runtime: "1h 52m",
    match: 88,
    genres: ["Family", "Fantasy", "Adventure"],
    cast: ["Anya Bell", "Mina Bell", "Oscar Finch"],
    artwork: {
      image: "/art/paper-kingdom.jpg",
      gradient:
        "radial-gradient(circle at 68% 34%, #f2d08e 0, transparent 21%), linear-gradient(132deg, #23150e, #874a2e 58%, #cc8a5b)",
      accent: "#f2d08e",
      motif: "rings",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
  {
    id: "zero-hour",
    name: "Zero Hour",
    tagline: "One minute. No mistakes.",
    description:
      "An emergency operator receives a call from herself—exactly sixty minutes in the future.",
    year: 2026,
    rating: "TV-MA",
    runtime: "7 episodes",
    match: 99,
    genres: ["Thriller", "Time Travel", "Crime"],
    cast: ["Sora Wynn", "Malik Ross", "Nico Bell"],
    badge: "Critics' Pick",
    artwork: {
      image: "/art/zero-hour.jpg",
      gradient:
        "radial-gradient(circle at 57% 49%, #ef525e 0, transparent 9%), conic-gradient(from 45deg at 57% 49%, #111 0 25%, #3b0d13 0 50%, #090909 0 75%, #701825 0)",
      accent: "#ef525e",
      motif: "orb",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
  {
    id: "the-bloom",
    name: "The Bloom",
    tagline: "Nature has a new design.",
    description:
      "After a strange pollen cloud crosses Europe, a botanist races to understand the beautiful transformation it leaves behind.",
    year: 2024,
    rating: "TV-14",
    runtime: "5 episodes",
    match: 92,
    genres: ["Eco-Thriller", "Sci-Fi", "Drama"],
    cast: ["Clara Moss", "Sven Holt", "Mara Liu"],
    artwork: {
      image: "/art/the-bloom.jpg",
      gradient:
        "radial-gradient(circle at 67% 33%, #d2ef86 0, transparent 16%), linear-gradient(134deg, #07140d, #23613b 52%, #829a4d)",
      accent: "#d2ef86",
      motif: "rings",
    },
    playback: { type: "mp4", src: sampleVideo },
  },
];

export const rails = [
  {
    title: "Continue Watching",
    ids: ["glass-ocean", "afterlight", "monument-valley"],
  },
  {
    title: "Trending Now",
    ids: [
      "zero-hour",
      "neon-runner",
      "the-bloom",
      "the-deepest-room",
      "paper-kingdom",
    ],
  },
  {
    title: "Only on NotFlix",
    ids: [
      "big-buck-bunny",
      "afterlight",
      "white-noise-club",
      "monument-valley",
      "the-deepest-room",
    ],
  },
  {
    title: "Stories Beyond This World",
    ids: [
      "glass-ocean",
      "big-buck-bunny",
      "zero-hour",
      "paper-kingdom",
      "neon-runner",
    ],
  },
];

export function titleById(id: string) {
  return titles.find((title) => title.id === id) ?? titles[0];
}
