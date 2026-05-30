import StoryboardScreen from '@/components/koda-os/screens/StoryboardScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="storyboard">
      <StoryboardScreen />
    </WorkflowShell>
  );
}
