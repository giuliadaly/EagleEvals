import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

const REVIEW_DATA = "eagleevals-public-reviews";
const CATALOG_DATA = "eagleevals-catalog";

// Only public, anonymous data belongs here. Never cache submissions or secrets.
export function publicQuery<Args extends unknown[], Result>(
  name: string,
  read: (...args: Args) => Promise<Result>,
  kind: "reviews" | "catalog" = "reviews",
) {
  return unstable_cache(read, ["public-data-v1", name], {
    tags: [kind === "catalog" ? CATALOG_DATA : REVIEW_DATA],
    revalidate: kind === "catalog" ? 86_400 : 3_600,
  });
}

export function expireReviewData() {
  // Route Handlers need expire: 0; the "max" profile can serve an old result.
  revalidateTag(REVIEW_DATA, { expire: 0 });
}
