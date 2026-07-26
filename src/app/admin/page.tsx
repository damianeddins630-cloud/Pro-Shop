import { redirect } from "next/navigation";

/** Old admin URL — Operations Home Base lives at /ops */
export default function AdminRedirectPage() {
  redirect("/ops");
}
