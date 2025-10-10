"use client";
import React from "react";
import { motion } from "framer-motion";
import PriceTable from "./price-table";
import VoucherForm from "./voucher-form";
import MoreVoucherFormInfo from "./voucher/more-info";

export default function VoucherBuyTest() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true, margin: "-50px 0px -100px 0px" }}
      className="mx-auto flex h-fit w-full max-w-2xl flex-col justify-between overflow-hidden rounded-xl bg-dark-blue"
    >
      <motion.div>
        <PriceTable />
      </motion.div>
      <motion.div>
        <VoucherForm testMode />
      </motion.div>
      <MoreVoucherFormInfo />
    </motion.div>
  );
}
