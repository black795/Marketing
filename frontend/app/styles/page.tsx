import StylesScreen from '@/components/koda-os/screens/StylesScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="styles">
      <StylesScreen />
    </WorkflowShell>
  );
}
