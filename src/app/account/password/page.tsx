import { getAccountSection } from "@/lib/account-fields";
import { SetPasswordForm } from "@/components/account/SetPasswordForm";

export default function AccountPasswordPage() {
  const section = getAccountSection("password");

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        {section?.title ?? "Password"}
      </h2>
      <div className="mt-6 rounded-2xl border border-lavender/30 bg-cream p-6 md:p-8">
        <SetPasswordForm />
      </div>
    </div>
  );
}
