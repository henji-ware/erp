import { SkeletonList } from "../components/Skeleton";

export default function Loading() {
  return <SkeletonList stats={0} form rows={10} cols={6} />;
}
