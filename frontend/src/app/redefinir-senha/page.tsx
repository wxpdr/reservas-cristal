import { AuthCard } from "@/components/auth-card";
import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";

type PageProps = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token = "" } = await searchParams;
  return (
    <AuthShell>
      <AuthCard title="Redefinir senha" description="Crie uma nova senha para recuperar seu acesso.">
        <PasswordForm
          token={token}
          endpoint="/api/auth/password-reset/complete"
          buttonLabel="Salvar nova senha"
        />
      </AuthCard>
    </AuthShell>
  );
}

