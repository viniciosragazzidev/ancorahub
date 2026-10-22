import { LightAuthShell } from "@/components/light/light-auth-shell";

/** Every access screen (login, 2FA, password reset, invitation) shares the Lite frame (22/10). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <LightAuthShell>{children}</LightAuthShell>;
}
