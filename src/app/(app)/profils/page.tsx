import { ProfileForm } from "@/components/profile-form";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilsPage() {
  const profiles = await prisma.serviceProfile.findMany({
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Configuration</p>
        <h1 className="mt-2 text-4xl font-medium tracking-[-0.07em]">Profils</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/66">
          Modifie ici les criteres, poids et seuils qui pilotent le matching. Les modifications s’appliquent au prochain scan et aux reevaluations manuelles.
        </p>
      </Card>

      <div className="space-y-6">
        {profiles.map((profile) => (
          <ProfileForm
            key={profile.id}
            id={profile.id}
            name={profile.name}
            scenario={profile.scenario}
            description={profile.description}
            criteria={JSON.stringify(profile.criteria, null, 2)}
            weights={JSON.stringify(profile.weights, null, 2)}
            thresholds={JSON.stringify(profile.thresholds, null, 2)}
          />
        ))}
      </div>
    </div>
  );
}
