import React from "react";
import ImageGallery from "../../_components/galery";

export default function page() {
  const getImages = () => {
    return [
      "/images/cachoeira-principal.avif",
      "/images/cachoeira2.avif",
      "/images/cachoeira3.avif",
      "/images/cachoeira4.avif",
      "/images/cachoeira5.avif",
      "/images/entrada-cachoeira.avif",
      "/images/placa-trilha-cachoeira2.avif",
      "/images/trilha2.avif",
      "/images/piscina-drone.avif",
      "/images/piscina-drone-2.avif",
      "/images/piscina-infantil.avif",
      "/images/piscinas-naturais.avif",
      "/images/praia.avif",
      "/images/quiosque.avif",
      "/images/quiosque2.avif",
      "/images/redario.avif",
      "/images/parquinho.avif",
    ];
  };

  return (
    <div className="mb-auto w-full justify-center pb-4">
      <div className="mx-auto mb-4 flex w-full items-center justify-center rounded-b-xl bg-dark-blue pb-2 md:mb-8 md:rounded-b-3xl">
        <h1 className="text-xl font-bold text-primary-50 md:text-3xl">
          Galeria de Fotos
        </h1>
      </div>
      <ImageGallery images={getImages()} />
    </div>
  );
}
