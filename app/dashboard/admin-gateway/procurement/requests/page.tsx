import { redirect } from 'next/navigation';

export default function LegacyPurchaseRequestsRedirect() {
  redirect('/dashboard/admin-gateway/materials/procurement/requests');
}
