"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

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
          ? "Este usuario esta desativado."
          : "Usuario ou senha incorretos.",
      );
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-5 rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Acesso da equipe</h1>
        <p className="text-sm text-muted-foreground">
          Entre com seu usuario e senha.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Usuario</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={isPending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          required
        />
      </div>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={!username.trim() || !password || isPending}
      >
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
