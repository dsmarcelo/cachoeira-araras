import Link from "next/link";

export default function AdminFooter() {
  return (
    <footer className="flex justify-center px-4 pb-4">
      <Link
        href="https://wa.me/5562996434112"
        target="_blank"
        className="p-3 text-xs text-muted-foreground hover:text-foreground"
      >
        Falar com o desenvolvedor
      </Link>
    </footer>
  );
}
