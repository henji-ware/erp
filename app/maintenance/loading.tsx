import { SkeletonList } from "../components/Skeleton";

export default function Loading() {
  return <SkeletonList stats={4} form rows={8} cols={5} />;
}
