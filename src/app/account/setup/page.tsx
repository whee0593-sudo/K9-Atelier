import { AccountSetupChecklist } from "@/components/account/AccountSetupChecklist";

export default function AccountSetupPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Complete your profile
      </h2>
      <div className="mt-8">
        <AccountSetupChecklist />
      </div>
    </div>
  );
}
