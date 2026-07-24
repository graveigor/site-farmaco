import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema Farma — Gestão de Distribuidora Farmacêutica",
  description:
    "Plataforma integrada de gestão para distribuidoras farmacêuticas: comercial, suprimentos, logística, financeiro, marketing e RH.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
