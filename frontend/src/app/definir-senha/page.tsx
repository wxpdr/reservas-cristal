import { AuthCard } from "@/components/auth-card";
import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";

type PageProps = { searchParams: Promise<{ token?: string }> };

export default async function FirstAccessPage({ searchParams }: PageProps) {
  const { token = "" } = await searchParams;
  return (
    <AuthShell>
      <AuthCard title="Definir sua senha" description="Crie sua senha para concluir o primeiro acesso.">
        <PasswordForm token={token} endpoint="/api/auth/first-access" buttonLabel="Criar senha" />
      </AuthCard>
    </AuthShell>
  );
}

