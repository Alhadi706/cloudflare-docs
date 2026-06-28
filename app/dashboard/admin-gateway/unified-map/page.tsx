import { redirect } from 'next/navigation';

export default function LegacyUnifiedMapRedirect() {
  redirect('/dashboard/admin-gateway');
}
