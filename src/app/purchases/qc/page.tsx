import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Quality Control | Food ERP',
};

// QC now lives inside Batch Manufacturing. Old links/bookmarks land on its QC tab.
export default function QCPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams({ tab: 'QC' });
  const { batchId, returnTo } = searchParams;
  if (typeof batchId === 'string') params.set('batchId', batchId);
  if (typeof returnTo === 'string') params.set('returnTo', returnTo);
  redirect(`/production/batches?${params.toString()}`);
}
