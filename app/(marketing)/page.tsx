import { InterviewTrainer } from "@/components/interview-trainer";
import { loadInterviewContent } from "@/lib/interview-content";

export const dynamic = "force-dynamic";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const section = Array.isArray(params.section) ? params.section[0] : params.section;
  const rawStage = Array.isArray(params.stage) ? params.stage[0] : params.stage;
  const parsedStage = section === "research" && rawStage ? Number(rawStage) : undefined;
  const content = loadInterviewContent();
  return (
    <InterviewTrainer
      content={content}
      initialResearchStage={Number.isInteger(parsedStage) ? parsedStage : undefined}
    />
  );
}
