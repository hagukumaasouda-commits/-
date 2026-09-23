import { prisma } from "@/lib/prisma";
import { updateVisit } from "@/app/actions/visits";
import { notFound } from "next/navigation";
import { VisitForm, type VisitFormDefaults } from "../../visit-form";
import type { StandingExamDefaults, SittingExamDefaults, SupineExamDefaults } from "../../basic-exam-section";

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

  const [staff, previousVisit] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.visit.findFirst({
      where: { clientId: id, visitNo: visit.visitNo - 1 },
      select: { chartRecord: { select: { healthPracticeInstruction: true } } },
    }),
  ]);
  const chartRecord = visit.chartRecord;
  const isLatestVisit = latestVisit?.id === visit.id;

  const treatmentModalities = chartRecord?.treatmentModalities as Record<string, boolean> | null;
  const lifestyleSupportStatus = chartRecord?.lifestyleSupportStatus as Record<string, boolean> | null;
  const standingExamJson = (chartRecord?.standingExam ?? null) as Record<string, unknown> | null;
  const sittingExamJson = (chartRecord?.sittingExam ?? null) as Record<string, unknown> | null;
  const supineExamJson = (chartRecord?.supineExam ?? null) as Record<string, unknown> | null;

  const standingExam: StandingExamDefaults = {
    distortion: (standingExamJson?.distortion as string[]) ?? [],
    transverseShift: (standingExamJson?.transverseShift as StandingExamDefaults["transverseShift"]) ?? "",
    tripodArch: (standingExamJson?.tripodArch as StandingExamDefaults["tripodArch"]) ?? "",
    weightAxis: (standingExamJson?.weightAxis as StandingExamDefaults["weightAxis"]) ?? "",
    muscleTensionAreas: (standingExamJson?.muscleTensionAreas as string[]) ?? [],
    muscleTensionNote: (standingExamJson?.muscleTensionNote as string) ?? "",
    flexionExtension: (standingExamJson?.flexionExtension as StandingExamDefaults["flexionExtension"]) ?? "",
    flexionExtensionNote: (standingExamJson?.flexionExtensionNote as string) ?? "",
    squatSingleLegNote: (standingExamJson?.squatSingleLegNote as string) ?? "",
    sendanSuspected: (standingExamJson?.sendanSuspected as boolean) ?? false,
    memo: (standingExamJson?.memo as string) ?? "",
  };

  const sittingExam: SittingExamDefaults = {
    armWeight: (sittingExamJson?.armWeight as SittingExamDefaults["armWeight"]) ?? "",
    shoulderRom: (sittingExamJson?.shoulderRom as SittingExamDefaults["shoulderRom"]) ?? "",
    spineDistortionTags: (sittingExamJson?.spineDistortionTags as string[]) ?? [],
    pelvisStiffness: (sittingExamJson?.pelvisStiffness as SittingExamDefaults["pelvisStiffness"]) ?? "",
    distortion: (sittingExamJson?.distortion as string[]) ?? [],
    transverseShift: (sittingExamJson?.transverseShift as SittingExamDefaults["transverseShift"]) ?? "",
    memo: (sittingExamJson?.memo as string) ?? "",
  };

  const supineExam: SupineExamDefaults = {
    legWeight: (supineExamJson?.legWeight as SupineExamDefaults["legWeight"]) ?? "",
    poplitealStagnation: (supineExamJson?.poplitealStagnation as SupineExamDefaults["poplitealStagnation"]) ?? "",
    hipPelvisStiffness: (supineExamJson?.hipPelvisStiffness as SupineExamDefaults["hipPelvisStiffness"]) ?? "",
    abdomenStiffness: (supineExamJson?.abdomenStiffness as SupineExamDefaults["abdomenStiffness"]) ?? "",
    ribStiffness: (supineExamJson?.ribStiffness as SupineExamDefaults["ribStiffness"]) ?? "",
    ribStiffnessNote: (supineExamJson?.ribStiffnessNote as string) ?? "",
    neckStiffness: (supineExamJson?.neckStiffness as SupineExamDefaults["neckStiffness"]) ?? "",
    headWeightTwist: (supineExamJson?.headWeightTwist as SupineExamDefaults["headWeightTwist"]) ?? "",
    headWeightTwistNote: (supineExamJson?.headWeightTwistNote as string) ?? "",
    memo: (supineExamJson?.memo as string) ?? "",
  };

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
    healthPracticeInstruction: chartRecord?.healthPracticeInstruction ?? "",
    standingExam,
    sittingExam,
    supineExam,
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
      previousHealthPracticeInstruction={previousVisit?.chartRecord?.healthPracticeInstruction}
    />
  );
}
