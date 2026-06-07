import CarouselScreen from '@/components/koda-os/screens/CarouselScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="carousel">
      <CarouselScreen />
    </WorkflowShell>
  );
}
