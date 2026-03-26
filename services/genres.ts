export type GenreName =
  | "Action"
  | "Horror"
  | "Sci-Fi"
  | "Comedy"
  | "Thriller"
  | "Fantasy"
  | "Romance"
  | "Western";

export interface GenreDefinition {
  name: GenreName;
  slug: string;
  description: string;
  thumbnail: string;
}

export const GENRES: GenreDefinition[] = [
  {
    name: "Action",
    slug: "action",
    description:
      "Explosive chases, impossible missions, and high-stakes showdowns.",
    thumbnail: "https://c.tenor.com/sSv2VKbHOHAAAAAC/tenor.gif",
  },
  {
    name: "Horror",
    slug: "horror",
    description:
      "Nightmares, haunted signals, and stories that linger after midnight.",
    thumbnail:
      "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Sci-Fi",
    slug: "sci-fi",
    description:
      "Future worlds, neon cities, strange tech, and impossible futures.",
    thumbnail:
      "https://images.unsplash.com/photo-1520034475321-cbe63696469a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Comedy",
    slug: "comedy",
    description: "Sharp timing, chaotic ensembles, and comfort-watch energy.",
    thumbnail:
      "https://images.unsplash.com/photo-1497032205916-ac775f0649ae?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Thriller",
    slug: "thriller",
    description: "Slow-burn tension, conspiracies, and edge-of-seat suspense.",
    thumbnail:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Fantasy",
    slug: "fantasy",
    description:
      "Ancient kingdoms, prophecy, and world-building on a grand scale.",
    thumbnail:
      "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Romance",
    slug: "romance",
    description:
      "Sweeping chemistry, longing glances, and unforgettable summers.",
    thumbnail:
      "https://cdn.shopify.com/s/files/1/0268/8847/0580/files/Irresistible_Chemistry_1024x1024.jpg?v=1719531436",
  },
  {
    name: "Western",
    slug: "western",
    description: "Dust, legend, and old scores settled under open skies.",
    thumbnail:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
  },
];

export const GENRE_NAMES = GENRES.map((genre) => genre.name);

export function getGenreBySlug(slug: string) {
  return GENRES.find((genre) => genre.slug === slug) ?? null;
}

export function getGenreByName(name: string) {
  return GENRES.find((genre) => genre.name === name) ?? null;
}
