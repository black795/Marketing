import TimelineScreen from '@/components/koda-os/screens/TimelineScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="timeline">
      <TimelineScreen />
    </WorkflowShell>
  );
}
