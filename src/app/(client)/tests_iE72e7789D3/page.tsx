import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireStaff } from "@/app/lib";

import TestVoucherBuy from "../../_components/voucher-buy-test";

export default async function Test() {
  const user = await requireStaff();

  if (!user) {
    redirect("/admin");
  }

  return (
    <div>
      <div className="flex min-h-screen flex-col items-center bg-bg-blue text-primary-200">
        <main className="flex flex-col items-center gap-6 px-4 py-4 md:px-8 md:py-8">
          <div className="flex w-full max-w-5xl flex-col justify-center gap-6 lg:flex-row">
            <TestVoucherBuy />
            <Button asChild>
              <a href="/api/cron">Test CRON JOBS</a>
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
