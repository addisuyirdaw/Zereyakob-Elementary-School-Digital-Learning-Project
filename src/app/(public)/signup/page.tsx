/**
 * /signup is no longer a public route.
 * New administrator accounts are provisioned by a super-admin via the dashboard.
 * Redirect any direct visitors to the home page.
 */
import { redirect } from "next/navigation";

export default function SignUpRedirect() {
  redirect("/");
}