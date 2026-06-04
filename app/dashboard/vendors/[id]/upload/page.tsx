import { CertificateUpload } from "@/components/dashboard/certificate-upload";

export const metadata = {
  title: "Upload certificate - COI Compliance Tracker"
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UploadPage({ params }: PageProps) {
  const { id } = await params;
  return <CertificateUpload vendorId={id} />;
}
