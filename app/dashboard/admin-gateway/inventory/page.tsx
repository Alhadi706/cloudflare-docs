import { redirect } from 'next/navigation';

export default function InventoryLegacyRedirect() {
  redirect('/dashboard/admin-gateway/materials/inventory');
}
