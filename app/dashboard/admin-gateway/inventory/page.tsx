import { redirect } from 'next/navigation';

// Phase 0 fix: materials/inventory does not exist yet — redirect to materials hub
// Will be updated in Phase 4 when materials/inventory is properly created
export default function InventoryLegacyRedirect() {
  redirect('/dashboard/admin-gateway/materials');
}
