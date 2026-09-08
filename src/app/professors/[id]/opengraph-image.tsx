import { socialPreview } from "@/components/social-preview";
import { getShareIdentity } from "@/data/queries";

export const alt = "Professor reviews on EagleEvals";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = await getShareIdentity("professor", id);
  if (!identity) return new Response("Professor not found", { status: 404 });
  return socialPreview("professor", identity.title, identity.subtitle);
}
