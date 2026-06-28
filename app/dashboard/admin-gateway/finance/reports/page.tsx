import { redirect } from 'next/navigation';

export default function FinanceReportsRedirectPage() {
  redirect('/dashboard/admin-gateway/reports/financial');
}
