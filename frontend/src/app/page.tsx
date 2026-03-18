import { redirect } from "next/navigation";

/** 根页面 → 重定向到 Dashboard */
export default function RootPage() {
  redirect("/dashboard");
}
