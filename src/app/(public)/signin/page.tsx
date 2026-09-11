/**
 * /signin is no longer a public page.
 * Administrators should use /admin-login instead.
 * This redirect keeps old bookmarks working while keeping the
 * login route discreet.
 */
import { redirect } from "next/navigation";

export default function SignInRedirect() {
  redirect("/admin-login");
}