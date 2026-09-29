"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronDown, UserPlus } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  Panel,
  PanelHeader,
  Segmented,
  StatusBadge,
} from "../../_components/admin-ui";

type AuthRole = "admin" | "user";

type ManagedUser = {
  id: string;
  username: string;
  role: AuthRole;
  banned: boolean;
};

const roleOptions = [
  { value: "user", label: "Funcionário" },
  { value: "admin", label: "Administrador" },
] as const;

const roleHelp: Record<AuthRole, string> = {
  user: "Funcionário valida vouchers e faz compra teste.",
  admin: "Administrador vê tudo, inclusive pagamentos e usuários.",
};

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-white px-3 text-sm font-normal shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50";
const primaryButton =
  "h-11 rounded-lg bg-zinc-900 text-sm font-semibold text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-45";
const outlineButton =
  "h-11 rounded-lg border border-border bg-white text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-45";

function readRole(value: string | null | undefined): AuthRole {
  return value?.split(",").includes("admin") ? "admin" : "user";
}

function getErrorMessage(error: { message?: string; code?: string } | null) {
  if (error?.code === "USERNAME_IS_ALREADY_TAKEN") {
    return "Este nome de usuário já está em uso.";
  }
  if (error?.code === "YOU_CANNOT_BAN_YOURSELF") {
    return "Você não pode desativar seu próprio acesso.";
  }

  return error?.message ?? "Não foi possível concluir a operação.";
}

export default function UserManager({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setError("");
    const result = await authClient.admin.listUsers({
      query: { limit: 100, sortBy: "name", sortDirection: "asc" },
    });

    if (result.error) {
      setError(getErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    setUsers(
      result.data.users.map((user) => ({
        id: user.id,
        username:
          "username" in user && typeof user.username === "string"
            ? user.username
            : user.name,
        role: readRole(user.role),
        banned: user.banned === true,
      })),
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Acessos cadastrados"
          description="Toque em uma pessoa para editar. Mudar função ou senha encerra as sessões dela."
        />
        {error ? <EmptyState tone="error">{error}</EmptyState> : null}
        {isLoading ? (
          <EmptyState>Carregando usuários...</EmptyState>
        ) : users.length === 0 && !error ? (
          <EmptyState>Nenhum usuário cadastrado.</EmptyState>
        ) : (
          <ul>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
                open={openId === user.id}
                onToggle={() => setOpenId((current) => (current === user.id ? null : user.id))}
                onChanged={loadUsers}
              />
            ))}
          </ul>
        )}
      </Panel>
      <CreateUserForm onCreated={loadUsers} />
    </>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthRole>("user");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const normalizedUsername = username.trim().toLowerCase();
      const { error } = await authClient.admin.createUser({
        email: `${crypto.randomUUID()}@internal.invalid`,
        name: normalizedUsername,
        password,
        role,
        data: { username: normalizedUsername },
      });

      if (error) {
        setMessage({ ok: false, text: getErrorMessage(error) });
        return;
      }

      setUsername("");
      setPassword("");
      setRole("user");
      setMessage({ ok: true, text: "Usuário criado." });
      await onCreated();
    });
  }

  return (
    <Panel>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <UserPlus className="size-4" aria-hidden />
          </span>
          <div className="flex flex-col">
            <h2 className="text-[15px] font-semibold tracking-tight">Novo acesso</h2>
            <p className="text-[13px] text-muted-foreground">
              A pessoa pode trocar usuário e senha depois do primeiro acesso.
            </p>
          </div>
        </div>
        <label htmlFor="new-user-username" className="flex flex-col gap-1.5 text-sm font-medium">
          Nome de usuário
          <input
            id="new-user-username"
            className={inputClass}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ex.: portaria2"
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9._]+"
            title="Use de 3 a 30 letras minúsculas, números, pontos ou sublinhados."
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            disabled={isPending}
            required
          />
        </label>
        <label htmlFor="new-user-password" className="flex flex-col gap-1.5 text-sm font-medium">
          Senha inicial
          <input
            id="new-user-password"
            className={inputClass}
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo de 5 caracteres"
            minLength={5}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending}
            required
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Função</span>
          <Segmented value={role} options={roleOptions} onChange={setRole} label="Função do novo acesso" />
          <span className="text-xs text-muted-foreground">{roleHelp[role]}</span>
        </div>
        <button type="submit" className={primaryButton} disabled={isPending}>
          {isPending ? "Criando..." : "Criar acesso"}
        </button>
        {message ? (
          <p aria-live="polite" className={cn("text-sm", message.ok ? "text-green-700" : "text-red-700")}>
            {message.text}
          </p>
        ) : null}
      </form>
    </Panel>
  );
}

function UserRow({
  user,
  isSelf,
  open,
  onToggle,
  onChanged,
}: {
  user: ManagedUser;
  isSelf: boolean;
  open: boolean;
  onToggle: () => void;
  onChanged: () => Promise<void>;
}) {
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<AuthRole>(user.role);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveProfile() {
    setMessage(null);
    startTransition(async () => {
      const normalizedUsername = username.trim().toLowerCase();

      if (normalizedUsername !== user.username) {
        const result = await authClient.admin.updateUser({
          userId: user.id,
          data: { username: normalizedUsername, name: normalizedUsername },
        });
        if (result.error) {
          setMessage({ ok: false, text: getErrorMessage(result.error) });
          return;
        }
      }

      if (role !== user.role && !isSelf) {
        const result = await authClient.admin.setRole({ userId: user.id, role });
        if (result.error) {
          setMessage({ ok: false, text: getErrorMessage(result.error) });
          return;
        }
        await authClient.admin.revokeUserSessions({ userId: user.id });
      }

      setMessage({ ok: true, text: "Dados atualizados." });
      await onChanged();
    });
  }

  function resetPassword() {
    setMessage(null);
    startTransition(async () => {
      const result = await authClient.admin.setUserPassword({
        userId: user.id,
        newPassword: password,
      });
      if (result.error) {
        setMessage({ ok: false, text: getErrorMessage(result.error) });
        return;
      }

      await authClient.admin.revokeUserSessions({ userId: user.id });
      setPassword("");
      setMessage({ ok: true, text: "Senha redefinida e sessões encerradas." });
    });
  }

  function toggleBan() {
    setMessage(null);
    startTransition(async () => {
      const result = user.banned
        ? await authClient.admin.unbanUser({ userId: user.id })
        : await authClient.admin.banUser({
            userId: user.id,
            banReason: "Acesso desativado por um administrador",
          });

      if (result.error) {
        setMessage({ ok: false, text: getErrorMessage(result.error) });
        return;
      }

      if (!user.banned) {
        await authClient.admin.revokeUserSessions({ userId: user.id });
      }
      await onChanged();
    });
  }

  const badge = user.banned
    ? { tone: "danger" as const, label: "Desativado" }
    : user.role === "admin"
      ? { tone: "success" as const, label: "Administrador" }
      : { tone: "neutral" as const, label: "Funcionário" };
  const locked = isPending || user.banned;

  return (
    <li className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 py-2.5 pl-5 pr-4 text-left transition-colors hover:bg-zinc-50",
          open && "bg-zinc-50",
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold uppercase",
            user.banned && "text-zinc-400",
          )}
        >
          {user.username.charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("truncate text-sm font-medium", user.banned && "text-muted-foreground")}>
            {user.username}
          </span>
          <span className="text-xs text-muted-foreground">
            {isSelf ? "Você" : user.banned ? "Acesso desativado" : "Toque para editar"}
          </span>
        </span>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        <ChevronDown
          className={cn("size-4 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-3.5 bg-zinc-50 px-5 pb-5 pt-1">
          <label htmlFor={`username-${user.id}`} className="flex flex-col gap-1.5 text-sm font-medium">
            Nome de usuário
            <input
              id={`username-${user.id}`}
              className={inputClass}
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9._]+"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              disabled={locked}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Função</span>
            {isSelf ? (
              <span className="text-xs text-muted-foreground">Você não pode mudar a sua própria função.</span>
            ) : (
              <Segmented
                value={role}
                options={roleOptions}
                onChange={setRole}
                label={`Função de ${user.username}`}
                className={locked ? "pointer-events-none opacity-50" : undefined}
              />
            )}
          </div>
          <button
            type="button"
            className={primaryButton}
            onClick={saveProfile}
            disabled={locked || !username.trim() || (username === user.username && role === user.role)}
          >
            Salvar dados
          </button>

          <div className="h-px bg-border" />

          <label htmlFor={`password-${user.id}`} className="flex flex-col gap-1.5 text-sm font-medium">
            Nova senha
            <input
              id={`password-${user.id}`}
              className={inputClass}
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 5 caracteres"
              minLength={5}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={locked}
            />
            <span className="text-xs font-normal text-muted-foreground">
              A pessoa será desconectada de todos os aparelhos.
            </span>
          </label>
          <button
            type="button"
            className={outlineButton}
            onClick={resetPassword}
            disabled={locked || password.length < 5}
          >
            Redefinir senha
          </button>
          {!isSelf ? (
            <button
              type="button"
              className={cn(outlineButton, !user.banned && "border-red-200 text-red-700 hover:bg-red-50")}
              onClick={toggleBan}
              disabled={isPending}
            >
              {user.banned ? "Reativar acesso" : "Desativar acesso"}
            </button>
          ) : null}
          {message ? (
            <p aria-live="polite" className={cn("text-sm", message.ok ? "text-green-700" : "text-red-700")}>
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
