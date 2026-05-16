import { redirect } from "next/navigation";

export default function LegacyNewRetainerPage() {
  redirect("/dashboard/send");
}
