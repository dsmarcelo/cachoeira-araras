"use client";

import { Button } from "@/components/ui/button";

export default function RefreshVoucherButton() {
  return (
    <Button variant="outline" onClick={() => window.location.reload()}>
      Atualizar pagamento
    </Button>
  );
}
