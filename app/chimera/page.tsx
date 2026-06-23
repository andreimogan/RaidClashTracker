import { ClashDetailView } from "@/components/ClashDetailView";

export default async function ChimeraPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  return <ClashDetailView clashType="chimera" weekParam={week} />;
}
