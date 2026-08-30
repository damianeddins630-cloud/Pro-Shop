import { redirect } from "next/navigation";

/** Sponsors live at the bottom of BVBC now. */
export default function SponsorsPage() {
  redirect("/bvbc#sponsors");
}
