'use client';
import { motion } from "framer-motion";
import React from "react";
import { MdOutlineDirectionsCar, MdLocalBar } from "react-icons/md";
import { IoSunnyOutline } from "react-icons/io5";
import { RiRestaurant2Line } from "react-icons/ri";
import { FaChild, FaTicketAlt } from "react-icons/fa";

const itemVariants = {
  hidden: { opacity: 0, y: -40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1 } },
};

export default function InfoCard() {
  return (
    <motion.div
      className="flex flex-col mx-auto text-xl text-primary-200 max-w-2xl px-4"
    >
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="font-semibold"
        variants={itemVariants}
      >
        Conforto, privacidade e contato direto com a natureza em uma localização
        privilegiada de Pirenópolis-GO.
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex gap-3 mt-9"
        variants={itemVariants}
      >
        <MdOutlineDirectionsCar className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Estacionamento</div>
          <div className="mt-3 font-light">
            Estacionamento facilitado próximo à cachoeira
          </div>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex gap-3 mt-4"
        variants={itemVariants}
      >
        <RiRestaurant2Line className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Restaurante</div>
          <div className="mt-3 font-light">
            Atendimento de excelência, comida de qualidade com preço humanizado
          </div>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex gap-3 mt-4"
        variants={itemVariants}
      >
        <MdLocalBar className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Bar</div>
          <div className="mt-3 font-light">
            Bar Pé de serra localizado próximo à cachoeira
          </div>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex gap-3 mt-4"
        variants={itemVariants}
      >
        <IoSunnyOutline className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Lazer diferenciado</div>
          <div className="mt-3 font-light">
            Paraiso natural com uma linda cachoeira
          </div>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex gap-3 mt-4"
        variants={itemVariants}
      >
        <FaChild className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Diversão para todos</div>
          <div className="mt-3 font-light">
            Playground para crianças, próximo aos quiosques
          </div>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex gap-3 mt-4"
        variants={itemVariants}
      >
        <FaTicketAlt className="h-6 w-6 mt-1" />
        <div className="flex flex-col flex-1">
          <div className="font-semibold">Entrada facilitada</div>
          <div className="mt-3 font-light">
            Compre seu voucher online por pix ou cartão e entre apenas apresentando o código na portaria
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
