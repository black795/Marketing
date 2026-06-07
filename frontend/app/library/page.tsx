import LibraryScreen from '@/components/koda-os/screens/LibraryScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="library" showCommandBar={false}>
      <LibraryScreen />
    </WorkflowShell>
  );
}
