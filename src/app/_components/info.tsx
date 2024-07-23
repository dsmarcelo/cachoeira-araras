import React from "react";
import { MdOutlineDirectionsCar, MdLocalBar } from "react-icons/md";
import { IoSunnyOutline } from "react-icons/io5";
import { RiRestaurant2Line } from "react-icons/ri";

export default function InfoCard() {
  return (
    <div className="flex flex-col mx-auto text-xl text-primary-200 max-w-2xl">
      <div className="font-semibold">
        Conforto, privacidade e contato direto com a natureza em uma localização
        privilegiada de Pirenópolis-GO.
      </div>
      <div className="flex gap-3 mt-9">
        <MdOutlineDirectionsCar className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Estacionamento</div>
          <div className="mt-3 font-light">
            Estacionamento facilitado próximo à cachoeira
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <RiRestaurant2Line className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Restaurante</div>
          <div className="mt-3 font-light">
            Atendimento de excelência, comida de qualidade com preço humanizado
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <MdLocalBar className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Bar</div>
          <div className="mt-3 font-light">
            Bar Pé de serra localizado próximo à cachoeira
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <IoSunnyOutline className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Lazer diferenciado</div>
          <div className="mt-3 font-light">
            Paraiso natural com uma linda cachoeira
          </div>
        </div>
      </div>
    </div>
  );
}