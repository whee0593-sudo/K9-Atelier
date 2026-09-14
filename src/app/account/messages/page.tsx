import { redirect } from "next/navigation";

/** Old in-site inbox URL — keep bookmarks from 404ing. */
export default function RetiredAccountMessagesPage() {
  redirect("/account");
}
