import { redirect } from 'next/navigation';

export default function MaterialsWarehousesRedirect() {
  redirect('/dashboard/admin-gateway/inventory/warehouses');
}
