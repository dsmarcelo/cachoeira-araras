import TestVoucherBuy from "../_components/voucher-buy-test";

export default async function Test() {
  return (
    <div>
      <div className="flex min-h-screen flex-col items-center bg-bg-blue text-primary-200">
        <main className="flex flex-col items-center px-4 gap-6 py-4 md:py-8 md:px-8">
          <div className="w-full max-w-5xl flex flex-col justify-center gap-6 lg:flex-row">
            <TestVoucherBuy />
          </div>
        </main>
      </div>
    </div>
  );
}
