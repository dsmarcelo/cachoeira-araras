"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Panel } from "../_components/admin-ui";

type Feedback = { ok: boolean; text: string } | null;

const inputClass =
  "h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50";

function errorMessage(error: { message?: string; code?: string } | null) {
  if (error?.code === "USERNAME_IS_ALREADY_TAKEN") {
    return "Este nome de usuário já está em uso.";
  }
  if (error?.code === "INVALID_PASSWORD") {
    return "A senha atual está incorreta.";
  }

  return error?.message ?? "Não foi possível salvar a alteração.";
}

function FeedbackText({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p aria-live="polite" className={cn("text-sm", feedback.ok ? "text-green-700" : "text-red-700")}>
      {feedback.text}
    </p>
  );
}

export default function AccountSettings({ username }: { username: string }) {
  const router = useRouter();
  const [nextUsername, setNextUsername] = useState(username);
  const [usernameFeedback, setUsernameFeedback] = useState<Feedback>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [isUsernamePending, startUsernameTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const mismatch = confirmation.length > 0 && newPassword !== confirmation;

  function updateUsername(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameFeedback(null);

    startUsernameTransition(async () => {
      const { error } = await authClient.updateUser({
        username: nextUsername.trim(),
      });

      if (error) {
        setUsernameFeedback({ ok: false, text: errorMessage(error) });
        return;
      }

      setUsernameFeedback({ ok: true, text: "Nome de usuário atualizado." });
      router.refresh();
    });
  }

  function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordFeedback(null);
    if (newPassword !== confirmation) return;

    startPasswordTransition(async () => {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        setPasswordFeedback({ ok: false, text: errorMessage(error) });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setPasswordFeedback({ ok: true, text: "Senha atualizada. As outras sessões foram encerradas." });
    });
  }

  return (
    <>
      <Panel className="p-5">
        <form onSubmit={updateUsername} className="flex flex-col gap-4">
          <h2 className="text-[15px] font-semibold tracking-tight">Nome de usuário</h2>
          <label htmlFor="account-username" className="flex flex-col gap-1.5 text-sm font-medium">
            Nome de usuário
            <input
              id="account-username"
              className={cn(inputClass, "border-border")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9._]+"
              title="Use de 3 a 30 letras minúsculas, números, pontos ou sublinhados."
              value={nextUsername}
              onChange={(event) => setNextUsername(event.target.value.toLowerCase())}
              disabled={isUsernamePending}
              required
            />
            <span className="text-xs font-normal text-muted-foreground">
              É o que você digita para entrar. Use de 3 a 30 letras, números, pontos ou sublinhados.
            </span>
          </label>
          <FeedbackText feedback={usernameFeedback} />
          <button
            type="submit"
            disabled={isUsernamePending || nextUsername.trim() === username}
            className="h-11 self-start rounded-lg border border-border bg-white px-5 text-sm font-medium shadow-sm hover:bg-zinc-50 disabled:opacity-45"
          >
            {isUsernamePending ? "Salvando..." : "Salvar nome"}
          </button>
        </form>
      </Panel>

      <Panel className="p-5">
        <form onSubmit={updatePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold tracking-tight">Senha</h2>
            <p className="text-[13px] text-muted-foreground">Ao trocar, os outros aparelhos saem da conta.</p>
          </div>
          <label htmlFor="current-password" className="flex flex-col gap-1.5 text-sm font-medium">
            Senha atual
            <input
              id="current-password"
              className={cn(inputClass, "border-border")}
              type="password"
              autoComplete="current-password"
              maxLength={128}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={isPasswordPending}
              required
            />
          </label>
          <label htmlFor="new-password" className="flex flex-col gap-1.5 text-sm font-medium">
            Nova senha
            <input
              id="new-password"
              className={cn(inputClass, "border-border")}
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 5 caracteres"
              minLength={5}
              maxLength={128}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={isPasswordPending}
              required
            />
          </label>
          <label htmlFor="confirm-password" className="flex flex-col gap-1.5 text-sm font-medium">
            Repita a nova senha
            <input
              id="confirm-password"
              className={cn(inputClass, mismatch ? "border-red-300" : "border-border")}
              type="password"
              autoComplete="new-password"
              minLength={5}
              maxLength={128}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? "password-mismatch" : undefined}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={isPasswordPending}
              required
            />
          </label>
          {mismatch ? (
            <p id="password-mismatch" role="alert" className="-mt-2 text-sm text-red-700">
              As novas senhas não conferem.
            </p>
          ) : null}
          <FeedbackText feedback={passwordFeedback} />
          <button
            type="submit"
            disabled={isPasswordPending || newPassword.length < 5 || newPassword !== confirmation || !currentPassword}
            className="h-11 rounded-lg bg-zinc-900 text-sm font-semibold text-zinc-50 hover:bg-zinc-800 disabled:opacity-45"
          >
            {isPasswordPending ? "Salvando..." : "Alterar senha"}
          </button>
        </form>
      </Panel>
    </>
  );
}
