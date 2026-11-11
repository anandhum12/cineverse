import { Checkout } from '@/components/checkout/Checkout';
export const metadata = { title: 'Checkout', robots: { index: false } };
export default function CheckoutPage({ params }: { params: { id: string } }) {
  return <Checkout bookingId={params.id} />;
}
