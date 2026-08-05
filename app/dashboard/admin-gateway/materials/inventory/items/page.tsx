import { redirect } from 'next/navigation';

export default function MaterialsItemsRedirect() {
  redirect('/dashboard/admin-gateway/inventory/items');
}
