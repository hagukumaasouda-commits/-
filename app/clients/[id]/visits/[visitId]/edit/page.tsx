import { prisma } from "@/lib/prisma";
import { updateVisit } from "@/app/actions/visits";
import { notFound } from "next/navigation";
import { VisitForm, type VisitFormDefaults } from "../../visit-form";

export default async function EditVisitPage({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id, visitId } = await params;

  const [client, visit, latestVisit] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true, rank: true } }),
    prisma.visit.findUnique({
      where: { id: visitId },
      include: { chartRecord: true },
    }),
    prisma.visit.findFirst({ where: { clientId: id }, orderBy: { visitNo: "desc" }, select: { id: true } }),
  ]);
  if (!client || !visit || visit.clientId !== id) notFound();

  const staff = await prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const chartRecord = visit.chartRecord;
  const isLatestVisit = latestVisit?.id === visit.id;

  const treatmentModalities = chartRecord?.treatmentModalities as Record<string, boolean> | null;
  const lifestyleSupportStatus = chartRecord?.lifestyleSupportStatus as Record<string, boolean> | null;

  const defaults: VisitFormDefaults = {
    visitDate: visit.visitDate.toISOString().slice(0, 10),
    staffId: visit.staffId,
    menuPlan: chartRecord?.menuPlan ?? "",
    chiefComplaintTags: chartRecord?.chiefComplaintTags ?? [],
    treatmentModalities: treatmentModalities
      ? Object.entries(treatmentModalities).filter(([, done]) => done).map(([item]) => item)
      : [],
    menuOverride: visit.menu ?? "",
    bodyPartTags: chartRecord?.bodyPartTags ?? [],
    lifestyleSupportStatus: lifestyleSupportStatus
      ? Object.entries(lifestyleSupportStatus).filter(([, done]) => done).map(([item]) => item)
      : [],
    healthPracticeNote: chartRecord?.healthPracticeNote ?? "",
    evaluation: chartRecord?.evaluation ?? "",
    changeFromLast: chartRecord?.changeFromLast ?? "",
    clientVoice: chartRecord?.clientVoice ?? "",
    nextCheck: chartRecord?.nextCheck ?? "",
    nextRequired: chartRecord?.nextRequired ?? "",
    requiredVisitInterval: chartRecord?.requiredVisitInterval ?? "",
    healthHappinessScore: chartRecord?.healthHappinessScore ?? "",
    rank: client.rank ?? "",
    isManualReturnFlag: chartRecord?.isManualReturnFlag ?? false,
    testimonialObtained: chartRecord?.testimonialObtained ?? false,
    testimonialObtainedDate: chartRecord?.testimonialObtainedDate?.toISOString().slice(0, 10) ?? "",
    referralGiven: chartRecord?.referralGiven ?? false,
    referralCount: chartRecord?.referralCount ?? 1,
  };

  return (
    <VisitForm
      heading={`来院記録の修正(第${visit.visitNo}回)`}
      clientName={client.name}
      action={updateVisit.bind(null, visit.id)}
      staff={staff}
      defaults={defaults}
      showRank={isLatestVisit}
      submitLabel="修正を保存する"
    />
  );
}
