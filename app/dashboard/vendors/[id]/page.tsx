import { VendorDetail } from "@/components/dashboard/vendor-detail";

export const metadata = {
  title: "Vendor detail - COI Compliance Tracker"
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VendorDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <VendorDetail vendorId={id} />;
}
