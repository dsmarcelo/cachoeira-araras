import { env } from "@/env";

export type InfoTopic = {
  key: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
};

export const infoTopics: InfoTopic[] = [
  {
    key: "cachoeira",
    title: env.NEXT_PUBLIC_INFO_CACHOEIRA_TITLE ?? "Cachoeira",
    description:
      env.NEXT_PUBLIC_INFO_CACHOEIRA_DESCRIPTION ??
      "Conforto, privacidade e contato direto com a natureza em uma localização privilegiada de Pirenópolis-GO.",
    image:
      env.NEXT_PUBLIC_INFO_CACHOEIRA_IMAGE ??
      "/images/cachoeira-principal.avif",
    imageAlt: env.NEXT_PUBLIC_INFO_CACHOEIRA_TITLE ?? "Cachoeira",
  },
  {
    key: "restaurante-bar-pe-de-serra",
    title:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_TITLE ??
      "Restaurante e bar Pe de Serra",
    description:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_DESCRIPTION ??
      "Atendimento de excelência, comida de qualidade com preço humanizado.",
    image:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_IMAGE ??
      "/images/prato.avif",
    imageAlt:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_TITLE ??
      "Restaurante e bar Pe de Serra",
  },
  {
    key: "piscina",
    title: env.NEXT_PUBLIC_INFO_PISCINA_TITLE ?? "Piscina",
    description:
      env.NEXT_PUBLIC_INFO_PISCINA_DESCRIPTION ??
      "Área de piscinas de adultos e crianças com bar acessível",
    image:
      env.NEXT_PUBLIC_INFO_PISCINA_IMAGE ??
      "/images/piscina-drone.avif",
    imageAlt: env.NEXT_PUBLIC_INFO_PISCINA_TITLE ?? "Piscina",
  },
  {
    key: "praia",
    title: env.NEXT_PUBLIC_INFO_PRAIA_TITLE ?? "Praia",
    description:
      env.NEXT_PUBLIC_INFO_PRAIA_DESCRIPTION ??
      "Espaço de praia para descansar, tomar sol e aproveitar o visual natural.",
    image: env.NEXT_PUBLIC_INFO_PRAIA_IMAGE ?? "/images/praia.avif",
    imageAlt: env.NEXT_PUBLIC_INFO_PRAIA_TITLE ?? "Praia",
  },
  {
    key: "bar-pe-na-areia",
    title:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_TITLE ?? "Bar pe na areia",
    description:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_DESCRIPTION ??
      "Bebidas e petiscos perto da praia para você relaxar sem pressa.",
    image:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_IMAGE ??
      "/images/bar-pe-na-areia.avif",
    imageAlt:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_TITLE ?? "Bar pe na areia",
  },
  {
    key: "redario",
    title: env.NEXT_PUBLIC_INFO_REDEIRO_TITLE ?? "Redário",
    description:
      env.NEXT_PUBLIC_INFO_REDEIRO_DESCRIPTION ??
      "Área coberta e privada com redes para descansar",
    image:
      env.NEXT_PUBLIC_INFO_REDEIRO_IMAGE ??
      "/images/redario.avif",
    imageAlt: env.NEXT_PUBLIC_INFO_REDEIRO_TITLE ?? "Redeiro",
  },
];
