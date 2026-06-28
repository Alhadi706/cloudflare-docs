import React from 'react';
import AdminGatewayLayoutClient from './layout-client';

export default function AdminGatewayLayout({ children }: { children: React.ReactNode }) {
  return <AdminGatewayLayoutClient>{children}</AdminGatewayLayoutClient>;
}
