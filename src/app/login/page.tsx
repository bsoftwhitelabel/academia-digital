"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou password incorretos.");
      setIsLoading(false);
    } else {
      const session = await getSession();
      const role = session?.user?.role;
      
      if (role === "TENANT_ADMIN" || role === "SUPER_ADMIN" || role === "TENANT_STAFF") {
        router.push("/admin/dashboard");
      } else if (role === "TRAINER") {
        router.push("/trainer/dashboard");
      } else if (role === "CLIENT_HR") {
        router.push("/client/dashboard");
      } else {
        router.push("/trainee/dashboard");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="bg-[#0B2447] text-white rounded-t-lg p-8 text-center">
          <CardTitle className="text-2xl font-bold">Academia Digital</CardTitle>
          <p className="text-sm text-gray-300 mt-1">Portal do Formando</p>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="o.seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0B2447] hover:bg-[#153460] text-white font-semibold py-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A entrar...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
