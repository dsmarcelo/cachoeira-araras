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
      "Aproveite o contato direto com a natureza em uma cachoeira privilegiada de Pirenopolis-GO.",
    image:
      env.NEXT_PUBLIC_INFO_CACHOEIRA_IMAGE ??
      "/images/principais/cachoeira-principal.png",
    imageAlt: env.NEXT_PUBLIC_INFO_CACHOEIRA_TITLE ?? "Cachoeira",
  },
  {
    key: "restaurante-bar-pe-de-serra",
    title:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_TITLE ??
      "Restaurante e bar Pe de Serra",
    description:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_DESCRIPTION ??
      "Comida de qualidade, atendimento acolhedor e estrutura para completar o seu passeio.",
    image:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_IMAGE ??
      "/images/principais/quiosque.png",
    imageAlt:
      env.NEXT_PUBLIC_INFO_RESTAURANTE_BAR_PE_DE_SERRA_TITLE ??
      "Restaurante e bar Pe de Serra",
  },
  {
    key: "piscina",
    title: env.NEXT_PUBLIC_INFO_PISCINA_TITLE ?? "Piscina",
    description:
      env.NEXT_PUBLIC_INFO_PISCINA_DESCRIPTION ??
      "Area de piscina para adultos e criancas curtirem o dia com conforto.",
    image:
      env.NEXT_PUBLIC_INFO_PISCINA_IMAGE ??
      "/images/principais/piscina-drone.png",
    imageAlt: env.NEXT_PUBLIC_INFO_PISCINA_TITLE ?? "Piscina",
  },
  {
    key: "praia",
    title: env.NEXT_PUBLIC_INFO_PRAIA_TITLE ?? "Praia",
    description:
      env.NEXT_PUBLIC_INFO_PRAIA_DESCRIPTION ??
      "Espaco de praia para descansar, tomar sol e aproveitar o visual natural.",
    image: env.NEXT_PUBLIC_INFO_PRAIA_IMAGE ?? "/images/principais/praia.jpg",
    imageAlt: env.NEXT_PUBLIC_INFO_PRAIA_TITLE ?? "Praia",
  },
  {
    key: "bar-pe-na-areia",
    title:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_TITLE ?? "Bar pe na areia",
    description:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_DESCRIPTION ??
      "Bebidas e petiscos perto da area de lazer para voce relaxar sem pressa.",
    image:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_IMAGE ??
      "/images/principais/piscinas-naturais.png",
    imageAlt:
      env.NEXT_PUBLIC_INFO_BAR_PE_NA_AREIA_TITLE ?? "Bar pe na areia",
  },
  {
    key: "redeiro",
    title: env.NEXT_PUBLIC_INFO_REDEIRO_TITLE ?? "Redeiro",
    description:
      env.NEXT_PUBLIC_INFO_REDEIRO_DESCRIPTION ??
      "Area com redes para descansar entre um mergulho e outro.",
    image:
      env.NEXT_PUBLIC_INFO_REDEIRO_IMAGE ??
      "/images/principais/redario.png",
    imageAlt: env.NEXT_PUBLIC_INFO_REDEIRO_TITLE ?? "Redeiro",
  },
];
