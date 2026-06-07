import CarouselManageScreen from '@/components/koda-os/screens/CarouselManageScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="carousel">
      <CarouselManageScreen />
    </WorkflowShell>
  );
}
