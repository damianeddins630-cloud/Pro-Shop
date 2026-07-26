import { OpsShell } from "@/components/ops/OpsShell";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <OpsShell>{children}</OpsShell>;
}
