import {
  formateDateDayMonthYear,
  formatPhone,
  truncateName,
} from "@/lib/utils";
import { formatQuantity } from "@/lib/voucher";
import { type Voucher } from "@prisma/client";
import Image from "next/image";
import React from "react";
import ShareCardBtn from "./shareCardBtn";

export default function VoucherCard({ data }: { data: Voucher }) {
  const { name, phone, adults, elderly, price, adults_pool, elderly_pool, status, expires_at, code } = data;
  const formatedExpiredDate = expires_at
    ? formateDateDayMonthYear(expires_at)
    : "";
  const formatedName = truncateName(name);
  const formatedPhone = formatPhone(phone);
  const formatedQuantity = formatQuantity({ adults, elderly, adults_pool, elderly_pool });

  let url = "";
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    url = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  } else if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    url = `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  } else {
    url = "http://localhost:3000";
  }

  const queryParams = `?name=${encodeURIComponent(formatedName)}&phone=${encodeURIComponent(formatedPhone)}&quantity=${encodeURIComponent(formatedQuantity)}&price=${price}&expires_at=${encodeURIComponent(formatedExpiredDate)}&status=${status}&code=${code}`;
  const imgURL = `${url}/api/og${queryParams}`;

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="relative aspect-[2/1] w-full">
        <Image
          className="w-full rounded-lg"
          src={imgURL}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
          // Avoid Next.js Image Optimization serverless hop; fetch OG directly
          unoptimized
          alt="Voucher"
        />
      </div>
      <ShareCardBtn imgURL={imgURL} code={code} />
    </div>
  );
}
