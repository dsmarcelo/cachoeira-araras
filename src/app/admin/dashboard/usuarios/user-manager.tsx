"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

type AuthRole = "admin" | "user";

type ManagedUser = {
  id: string;
  username: string;
  role: AuthRole;
  banned: boolean;
};

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
    <div className="space-y-6">
      <CreateUserForm onCreated={loadUsers} />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acessos cadastrados</CardTitle>
          <CardDescription>
            Alterar a função ou a senha encerra as outras sessões do usuário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {isLoading ? (
            <p className="py-8 text-sm text-muted-foreground">
              Carregando usuários...
            </p>
          ) : users.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              Nenhum usuário cadastrado.
            </p>
          ) : (
            users.map((user) => (
              <UserEditor
                key={user.id}
                user={user}
                currentUserId={currentUserId}
                onChanged={loadUsers}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthRole>("user");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

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
        setMessage(getErrorMessage(error));
        return;
      }

      setUsername("");
      setPassword("");
      setRole("user");
      setMessage("Usuário criado.");
      await onCreated();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5" /> Novo usuário
        </CardTitle>
        <CardDescription>
          A pessoa poderá trocar o nome de usuário e a senha depois do primeiro
          acesso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid items-end gap-4 md:grid-cols-[1fr_1fr_12rem_auto]"
        >
          <div className="space-y-2">
            <Label htmlFor="new-user-username">Nome de usuário</Label>
            <Input
              id="new-user-username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9._]+"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value.toLowerCase())
              }
              disabled={isPending}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-password">Senha inicial</Label>
            <Input
              id="new-user-password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <RoleSelect value={role} onChange={setRole} disabled={isPending} />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Criando..." : "Criar acesso"}
          </Button>
          {message ? (
            <p
              aria-live="polite"
              className="text-sm text-muted-foreground md:col-span-4"
            >
              {message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function UserEditor({
  user,
  currentUserId,
  onChanged,
}: {
  user: ManagedUser;
  currentUserId: string;
  onChanged: () => Promise<void>;
}) {
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<AuthRole>(user.role);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function saveProfile() {
    setMessage("");
    startTransition(async () => {
      const normalizedUsername = username.trim().toLowerCase();

      if (normalizedUsername !== user.username) {
        const result = await authClient.admin.updateUser({
          userId: user.id,
          data: { username: normalizedUsername, name: normalizedUsername },
        });
        if (result.error) {
          setMessage(getErrorMessage(result.error));
          return;
        }
      }

      if (role !== user.role && user.id !== currentUserId) {
        const result = await authClient.admin.setRole({
          userId: user.id,
          role,
        });
        if (result.error) {
          setMessage(getErrorMessage(result.error));
          return;
        }
        await authClient.admin.revokeUserSessions({ userId: user.id });
      }

      setMessage("Dados atualizados.");
      await onChanged();
    });
  }

  function resetPassword() {
    setMessage("");
    startTransition(async () => {
      const result = await authClient.admin.setUserPassword({
        userId: user.id,
        newPassword: password,
      });
      if (result.error) {
        setMessage(getErrorMessage(result.error));
        return;
      }

      await authClient.admin.revokeUserSessions({ userId: user.id });
      setPassword("");
      setMessage("Senha redefinida e sessões encerradas.");
    });
  }

  function toggleBan() {
    setMessage("");
    startTransition(async () => {
      const result = user.banned
        ? await authClient.admin.unbanUser({ userId: user.id })
        : await authClient.admin.banUser({
            userId: user.id,
            banReason: "Acesso desativado por um administrador",
          });

      if (result.error) {
        setMessage(getErrorMessage(result.error));
        return;
      }

      if (!user.banned) {
        await authClient.admin.revokeUserSessions({ userId: user.id });
      }
      await onChanged();
    });
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="grid items-end gap-4 md:grid-cols-[1fr_12rem_auto]">
        <div className="space-y-2">
          <Label htmlFor={`username-${user.id}`}>Nome de usuário</Label>
          <Input
            id={`username-${user.id}`}
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9._]+"
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            disabled={isPending || user.banned}
          />
        </div>
        <div className="space-y-2">
          <Label>Função</Label>
          <RoleSelect
            value={role}
            onChange={setRole}
            disabled={isPending || user.banned || user.id === currentUserId}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={saveProfile}
          disabled={
            isPending ||
            user.banned ||
            !username.trim() ||
            (username === user.username && role === user.role)
          }
        >
          Salvar dados
        </Button>
      </div>

      <div className="grid items-end gap-4 border-t pt-4 md:grid-cols-[1fr_auto_auto]">
        <div className="space-y-2">
          <Label htmlFor={`password-${user.id}`}>Nova senha</Label>
          <Input
            id={`password-${user.id}`}
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending || user.banned}
            placeholder="Mínimo de 10 caracteres"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={resetPassword}
          disabled={isPending || user.banned || password.length < 10}
        >
          Redefinir senha
        </Button>
        <Button
          type="button"
          variant={user.banned ? "outline" : "destructive"}
          onClick={toggleBan}
          disabled={isPending}
        >
          {user.banned ? "Reativar acesso" : "Desativar acesso"}
        </Button>
      </div>
      {message ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: AuthRole;
  onChange: (role: AuthRole) => void;
  disabled: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(readRole(next))}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">Funcionário</SelectItem>
        <SelectItem value="admin">Administrador</SelectItem>
      </SelectContent>
    </Select>
  );
}
