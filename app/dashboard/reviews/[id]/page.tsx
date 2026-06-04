import { ReviewDetail } from "@/components/dashboard/review-detail";

export const metadata = {
  title: "Review detail - COI Compliance Tracker"
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ReviewDetail reviewId={id} />;
}
