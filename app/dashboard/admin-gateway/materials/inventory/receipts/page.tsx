import { redirect } from 'next/navigation';

export default function MaterialsReceiptsRedirect() {
  redirect('/dashboard/admin-gateway/inventory/receipts');
}
