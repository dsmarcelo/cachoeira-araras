"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplets } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-lg border bg-white px-3 text-[15px] font-normal shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50";

/** Staff sign-in shown by the /admin layout when there is no session. */
export default function PasswordLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const { error } = await authClient.signIn.username({
        username: username.trim(),
        password,
      });

      if (!error) {
        router.replace("/admin");
        router.refresh();
        return;
      }

      setMessage(
        error.code === "BANNED_USER"
          ? "Este usuário está desativado. Fale com o administrador."
          : "Usuário ou senha incorretos. Tente novamente.",
      );
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-teal-700 text-white">
          <Droplets className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold tracking-tight">Acesso da equipe</h1>
          <p className="text-sm text-muted-foreground">
            Entre com o usuário que o administrador criou para você.
          </p>
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <label htmlFor="username" className="flex flex-col gap-1.5 text-sm font-medium">
          Usuário
          <input
            id="username"
            name="username"
            className={cn(inputClass, "border-border")}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={isPending}
            required
          />
        </label>
        <label htmlFor="password" className="flex flex-col gap-1.5 text-sm font-medium">
          Senha
          <input
            id="password"
            name="password"
            type="password"
            className={cn(inputClass, message ? "border-red-300" : "border-border")}
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending}
            required
          />
        </label>
        {message ? (
          <p role="alert" className="text-[13px] text-red-700">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!username.trim() || !password || isPending}
          className="mt-1 h-12 rounded-lg bg-zinc-900 text-[15px] font-semibold text-zinc-50 hover:bg-zinc-800 disabled:opacity-45"
        >
          {isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
