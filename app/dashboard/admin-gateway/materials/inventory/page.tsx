import { redirect } from 'next/navigation';

export default function MaterialsInventoryRedirect() {
  redirect('/dashboard/admin-gateway/inventory/warehouses');
}
