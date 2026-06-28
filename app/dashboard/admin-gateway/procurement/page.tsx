import { redirect } from 'next/navigation';

export default function ProcurementLegacyRedirect() {
  redirect('/dashboard/admin-gateway/materials/procurement');
}
