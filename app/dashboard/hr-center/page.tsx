import { permanentRedirect } from 'next/navigation';

// Phase 1: hr-center → canonical admin-gateway/hr
export default function HRCenterPage() {
  permanentRedirect('/dashboard/admin-gateway/hr');
}
