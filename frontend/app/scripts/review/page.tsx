import ReviewScreen from '@/components/koda-os/screens/ReviewScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="review">
      <ReviewScreen />
    </WorkflowShell>
  );
}
