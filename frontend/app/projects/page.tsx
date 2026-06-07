import ProjectsScreen from '@/components/koda-os/screens/ProjectsScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="projects" showCommandBar={false}>
      <ProjectsScreen />
    </WorkflowShell>
  );
}
