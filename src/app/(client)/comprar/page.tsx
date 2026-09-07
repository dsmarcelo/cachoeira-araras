import { redirect } from "next/navigation";

// Legacy purchase route, kept only to redirect old links to the home page
// where the voucher purchase flow now lives.
export default async function Home() {
  redirect("/");
}
