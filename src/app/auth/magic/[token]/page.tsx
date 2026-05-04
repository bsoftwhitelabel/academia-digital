"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function MagicLinkPage({
  params,
}: {
  params: { token: string };
}) {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!params.token) return;

    const authenticate = async () => {
      try {
        const res = await signIn("credentials", {
          magicToken: params.token,
          redirect: false,
        });

        if (res?.error) {
          setError(true);
        } else {
          router.push("/trainee/dashboard");
        }
      } catch (err) {
        console.error(err);
        setError(true);
      }
    };

    authenticate();
  }, [params.token, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center space-y-4 rounded-lg bg-white p-8 shadow-md">
        {error ? (
          <>
            <h2 className="text-xl font-semibold text-red-600">
              Link Inválido ou Expirado
            </h2>
            <p className="text-sm text-gray-500">
              Por favor, solicite um novo link de acesso à sua entidade formadora.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Voltar ao Login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              A autenticar...
            </h2>
            <p className="text-sm text-gray-500">
              Aguarde enquanto verificamos o seu acesso seguro.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
