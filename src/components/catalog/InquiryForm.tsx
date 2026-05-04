"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const inquirySchema = z.object({
  firstName: z.string().min(2, "Nome é obrigatório"),
  lastName: z.string().min(2, "Apelido é obrigatório"),
  email: z.string().email("E-mail inválido"),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
});

type InquiryFormValues = z.infer<typeof inquirySchema>;

export function InquiryDialog({
  courseId,
  courseName,
  tenantSlug,
}: {
  courseId: string;
  courseName: string;
  tenantSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      company: "",
      jobTitle: "",
      phone: "",
      message: "",
    },
  });

  const onSubmit = async (data: InquiryFormValues) => {
    try {
      const res = await fetch(`/api/catalog/${tenantSlug}/inquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          courseId,
          courseName,
        }),
      });

      if (res.ok) {
        setIsSuccess(true);
        form.reset();
      } else {
        console.error("Falha ao enviar interesse");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-[#0B2447] font-semibold text-white hover:bg-[#153460]">
          Tenho Interesse
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[#0B2447]">
            Demonstrar Interesse
          </DialogTitle>
          <DialogDescription>
            Deixe os seus dados para recebermos o seu interesse no curso{" "}
            <strong>{courseName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Pedido enviado com sucesso!
            </h3>
            <p className="text-sm text-gray-500">
              A nossa equipa entrará em contacto brevemente com mais informações.
            </p>
            <Button
              onClick={() => {
                setOpen(false);
                setIsSuccess(false);
              }}
              variant="outline"
              className="mt-4"
            >
              Fechar
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="O seu nome" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apelido *</FormLabel>
                      <FormControl>
                        <Input placeholder="O seu apelido" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="nome@empresa.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telemóvel</FormLabel>
                    <FormControl>
                      <Input placeholder="Opcional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Input placeholder="Alguma dúvida específica?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full bg-[#0B2447] hover:bg-[#153460]"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A enviar...
                  </>
                ) : (
                  "Enviar Pedido"
                )}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
