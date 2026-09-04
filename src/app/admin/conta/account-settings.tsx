"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function errorMessage(error: { message?: string; code?: string } | null) {
  if (error?.code === "USERNAME_IS_ALREADY_TAKEN") {
    return "Este nome de usuário já está em uso.";
  }

  return error?.message ?? "Não foi possível salvar a alteração.";
}

export default function AccountSettings({ username }: { username: string }) {
  const router = useRouter();
  const [nextUsername, setNextUsername] = useState(username);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isUsernamePending, startUsernameTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  function updateUsername(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameMessage("");

    startUsernameTransition(async () => {
      const { error } = await authClient.updateUser({
        username: nextUsername.trim(),
      });

      if (error) {
        setUsernameMessage(errorMessage(error));
        return;
      }

      setUsernameMessage("Nome de usuário atualizado.");
      router.refresh();
    });
  }

  function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");

    if (newPassword !== confirmation) {
      setPasswordMessage("As novas senhas não conferem.");
      return;
    }

    startPasswordTransition(async () => {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        setPasswordMessage(errorMessage(error));
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setPasswordMessage(
        "Senha atualizada. As outras sessões foram encerradas.",
      );
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nome de usuário</CardTitle>
          <CardDescription>
            Use de 3 a 30 letras, números, pontos ou sublinhados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={updateUsername} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-username">Nome de usuário</Label>
              <Input
                id="account-username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                minLength={3}
                maxLength={30}
                pattern="[a-z0-9._]+"
                value={nextUsername}
                onChange={(event) =>
                  setNextUsername(event.target.value.toLowerCase())
                }
                disabled={isUsernamePending}
                required
              />
            </div>
            {usernameMessage ? (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {usernameMessage}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={isUsernamePending || nextUsername.trim() === username}
            >
              {isUsernamePending ? "Salvando..." : "Salvar nome"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Senha</CardTitle>
          <CardDescription>
            A nova senha deve ter pelo menos 10 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={updatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isPasswordPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={5}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isPasswordPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Repita a nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={5}
                maxLength={128}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={isPasswordPending}
                required
              />
            </div>
            {passwordMessage ? (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {passwordMessage}
              </p>
            ) : null}
            <Button type="submit" disabled={isPasswordPending}>
              {isPasswordPending ? "Salvando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
