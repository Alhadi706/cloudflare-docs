import { redirect } from 'next/navigation';

export default function MaterialsIssuesRedirect() {
  redirect('/dashboard/admin-gateway/inventory/issues');
}
