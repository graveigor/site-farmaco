import Link from "next/link";
import { Card, CardBody } from "@/components/ui";

export default function SemAcesso() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardBody>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 8v5M12 16h.01M10.3 3.9L2.4 17.3A1.9 1.9 0 004 20h16a1.9 1.9 0 001.6-2.7L13.7 3.9a1.9 1.9 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-tinta-900">Acesso não autorizado</h1>
          <p className="mt-2 text-sm text-tinta-500">
            Seu perfil não possui permissão para acessar este módulo. Caso precise deste acesso, solicite ao
            administrador do sistema.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex rounded-lg bg-marca-600 px-4 py-2 text-sm font-medium text-white hover:bg-marca-700"
          >
            Voltar ao dashboard
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
