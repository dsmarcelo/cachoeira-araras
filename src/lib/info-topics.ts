import { env } from "@/env";

export type InfoTopic = {
  key: string;
  title: string;
  description: string;
  images: string[];
  imageAlt: string;
};

/** Default gallery paths under public/images, grouped by category filename prefix. */
const DEFAULT_IMAGES = {
  cachoeira: [
    "/images/cachoeira-1.avif",
    "/images/cachoeira-2.avif",
    "/images/cachoeira-3.avif",
  ],
  restaurante: ["/images/restaurante-1.avif", "/images/restaurante-2.avif"],
  piscina: [
    "/images/piscina-1.avif",
    "/images/piscina-2.avif",
    "/images/piscina-3.avif",
  ],
  praia: [
    "/images/praia-1.avif", 
    "/images/praia-2.avif",
    "/images/praia-3.avif",
    "/images/praia-4.avif",
  ],
  barPeNaAreia: ["/images/bar-pe-na-areia-1.avif"],
  redario: ["/images/redario-1.avif"],
} as const;

function imagesWithEnvOverride(
  envImage: string | undefined,
  defaults: readonly string[],
): string[] {
  return envImage ? [envImage] : [...defaults];
}

export const infoTopics: InfoTopic[] = [
  {
    key: "cachoeira",
    title: env.NEXT_PUBLIC_INFO_CACHOEIRA_TITLE ?? "Cachoeira",
    description:
      env.NEXT_PUBLIC_INFO_CACHOEIRA_DESCRIPTION ??
      "Conforto, privacidade e contato direto com a natureza em uma localização privilegiada de Pirenópolis-GO.",
    images: imagesWithEnvOverride(
      env.NEXT_PUBLIC_INFO_CACHOEIRA_IMAGE,
      DEFAULT_IMAGES.cachoeira,
    ),
    imageAlt: env.NEXT_PUBLIC_INFO_CACHOEIRA_TITLE ?? "Cachoeira",
  },
  {
    key: "restaurante-bar-pe-de-serra",
    title:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_TITLE ??
      "Restaurante e bar Pé de Serra",
    description:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_DESCRIPTION ??
      "Atendimento de excelência e comida de qualidade com preços humanizados.",
    images: imagesWithEnvOverride(
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_IMAGE,
      DEFAULT_IMAGES.restaurante,
    ),
    imageAlt:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_TITLE ??
      "Restaurante e bar Pé de Serra",
  },
  {
    key: "piscina",
    title: env.NEXT_PUBLIC_INFO_PISCINA_TITLE ?? "Piscina",
    description:
      env.NEXT_PUBLIC_INFO_PISCINA_DESCRIPTION ??
      "Área de piscinas para adultos e crianças, com bar acessível.",
    images: imagesWithEnvOverride(
      env.NEXT_PUBLIC_INFO_PISCINA_IMAGE,
      DEFAULT_IMAGES.piscina,
    ),
    imageAlt: env.NEXT_PUBLIC_INFO_PISCINA_TITLE ?? "Piscina",
  },
  {
    key: "praia",
    title: env.NEXT_PUBLIC_INFO_PRAIA_TITLE ?? "Praia",
    description:
      env.NEXT_PUBLIC_INFO_PRAIA_DESCRIPTION ??
      "Espaço de praia para descansar, tomar sol e aproveitar o visual natural.",
    images: imagesWithEnvOverride(
      env.NEXT_PUBLIC_INFO_PRAIA_IMAGE,
      DEFAULT_IMAGES.praia,
    ),
    imageAlt: env.NEXT_PUBLIC_INFO_PRAIA_TITLE ?? "Praia",
  },
  {
    key: "bar-pe-na-areia",
    title:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_TITLE ?? "Bar Pé na Areia",
    description:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_DESCRIPTION ??
      "Bebidas e petiscos perto da praia para você relaxar sem pressa.",
    images: imagesWithEnvOverride(
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_IMAGE,
      DEFAULT_IMAGES.barPeNaAreia,
    ),
    imageAlt:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_TITLE ?? "Bar Pé na Areia",
  },
  {
    key: "redario",
    title: env.NEXT_PUBLIC_INFO_REDEIRO_TITLE ?? "Redário",
    description:
      env.NEXT_PUBLIC_INFO_REDEIRO_DESCRIPTION ??
      "Área coberta e privada com redes para descansar.",
    images: imagesWithEnvOverride(
      env.NEXT_PUBLIC_INFO_REDEIRO_IMAGE,
      DEFAULT_IMAGES.redario,
    ),
    imageAlt: env.NEXT_PUBLIC_INFO_REDEIRO_TITLE ?? "Redário",
  },
];
