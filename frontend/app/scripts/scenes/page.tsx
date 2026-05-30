import ScenesScreen from '@/components/koda-os/screens/ScenesScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="scenes">
      <ScenesScreen />
    </WorkflowShell>
  );
}
