import { Button } from "@/components/ui/button";
import TestVoucherBuy from "../../_components/voucher-buy-test";
import { isLoggedIn } from "@/app/lib";
import PasswordLoginForm from "@/app/_components/passwordLoginForm";

export default async function Test() {
  async function TestCronJobs() {
    return await fetch("/api/cron", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });
  }

  const isAdmin = await isLoggedIn();
  if (!isAdmin) {
    return <div className='flex min-h-screen w-full flex-col items-center justify-center px-4'>
      <PasswordLoginForm />
    </div>
  }

  return (
    <div>
      <div className="flex min-h-screen flex-col items-center bg-bg-blue text-primary-200">
        <main className="flex flex-col items-center px-4 gap-6 py-4 md:py-8 md:px-8">
          <div className="w-full max-w-5xl flex flex-col justify-center gap-6 lg:flex-row">
            <TestVoucherBuy />
            <Button onClick={TestCronJobs}>Test CRON JOBS</Button>
          </div>
        </main>
      </div>
    </div>
  );
}
