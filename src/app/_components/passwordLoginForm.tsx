"use client";

import React, { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PasswordLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const result = await signIn("credentials", {
        callbackUrl: "/admin",
        password,
        redirect: false,
      });

      if (result?.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }

      setMessage(
        result?.error === "Configuration"
          ? "Autenticacao indisponivel. Verifique a configuracao de acesso."
          : "Senha incorreta",
      );
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mb-auto mt-6 flex w-full max-w-lg flex-col gap-4 px-6"
    >
      <h3>Digite a senha para entrar</h3>
      <Input
        id="password"
        placeholder="Senha"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button
        type="submit"
        className="w-full"
        disabled={!password || isPending}
      >
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
      <p className="text-sm text-red-500">{message}</p>
    </form>
  );
}
