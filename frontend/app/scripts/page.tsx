import PromptScreen from '@/components/koda-os/screens/PromptScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="prompt">
      <PromptScreen />
    </WorkflowShell>
  );
}
