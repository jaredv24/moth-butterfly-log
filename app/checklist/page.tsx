import { redirect } from "next/navigation";
export default function ChecklistRedirect() {
  redirect("/journal?tab=checklist");
}
