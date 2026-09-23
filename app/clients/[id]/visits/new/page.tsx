import { prisma } from "@/lib/prisma";
import { createVisit } from "@/app/actions/visits";
import { notFound } from "next/navigation";
import { VisitForm } from "../visit-form";

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true, rank: true } });
  if (!client) notFound();

  const [staff, lastVisit] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.visit.findFirst({
      where: { clientId: client.id },
      orderBy: { visitNo: "desc" },
      select: { chartRecord: { select: { healthPracticeInstruction: true } } },
    }),
  ]);
  const action = createVisit.bind(null, client.id);

  return (
    <VisitForm
      heading="来院記録・カルテ入力"
      clientName={client.name}
      action={action}
      staff={staff}
      defaults={{ rank: client.rank ?? "" }}
      submitLabel="カルテを保存する"
      previousHealthPracticeInstruction={lastVisit?.chartRecord?.healthPracticeInstruction}
    />
  );
}
