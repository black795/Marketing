import CarouselReviewScreen from '@/components/koda-os/screens/CarouselReviewScreen';
import { WorkflowShell } from '@/components/koda-os/shell';

export default function Page() {
  return (
    <WorkflowShell phase="carousel">
      <CarouselReviewScreen />
    </WorkflowShell>
  );
}
