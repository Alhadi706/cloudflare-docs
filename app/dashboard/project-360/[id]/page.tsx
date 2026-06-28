import Project360Client from '@/app/dashboard/project-360/components/Project360Client';

export default function Project360DetailPage({ params }: { params: { id: string } }) {
  const projectId = String(params.id || '').trim();

  return <Project360Client projectId={projectId} />;
}
