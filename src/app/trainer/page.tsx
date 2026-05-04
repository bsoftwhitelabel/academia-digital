import { redirect } from "next/navigation";

export default function TrainerIndexPage() {
  redirect("/trainer/sessions");
}
