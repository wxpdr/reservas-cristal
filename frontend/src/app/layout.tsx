import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservas Cristal",
  description: "Sistema interno de reservas da Cristal Pizza",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

