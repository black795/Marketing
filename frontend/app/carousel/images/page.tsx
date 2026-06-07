import CarouselImagesScreen from '@/components/koda-os/screens/CarouselImagesScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="carousel">
      <CarouselImagesScreen />
    </WorkflowShell>
  );
}
