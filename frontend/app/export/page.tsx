import ExportScreen from '@/components/koda-os/screens/ExportScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="export">
      <ExportScreen />
    </WorkflowShell>
  );
}
