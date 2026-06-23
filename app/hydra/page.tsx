import { ClashDetailView } from "@/components/ClashDetailView";

export default async function HydraPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  return <ClashDetailView clashType="hydra" weekParam={week} />;
}
