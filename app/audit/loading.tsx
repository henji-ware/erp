import { SkeletonList } from "../components/Skeleton";

export default function Loading() {
  return <SkeletonList form={false} rows={12} cols={5} />;
}
