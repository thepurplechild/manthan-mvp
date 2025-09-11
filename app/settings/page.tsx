import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = {
  title: "Settings • Manthan",
  description: "Account and preferences.",
};

export default function SettingsPage() {
  return (
    <section className="container mx-auto px-6 py-10 max-w-2xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />
      <h1 className="text-3xl font-heading font-bold text-manthan-charcoal-800 mb-4">Settings</h1>
      <div className="card-indian p-6">
        <p className="text-manthan-charcoal-600">Feature toggles and preferences will appear here.</p>
      </div>
    </section>
  );
}

