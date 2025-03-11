import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default function QRPage() {
  redirect('https://wa.me/c/556299251040');
  return <div className="h-screen flex items-center justify-center">
    <Button asChild>
      <Link href='https://wa.me/c/556299251040'>Cardápio</Link>
    </Button>
  </div>
}