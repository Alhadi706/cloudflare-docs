// Entry page has its own full-screen layout — no header, no sidebar
export default function EntryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
