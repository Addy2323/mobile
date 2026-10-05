import {
  Hotel, UtensilsCrossed, Plane, Calendar, ShoppingBag, Home, Receipt,
  type LucideIcon,
} from 'lucide-react';

export const categoryIconMap: Record<string, LucideIcon> = {
  hotel: Hotel,
  restaurant: UtensilsCrossed,
  travel: Plane,
  events: Calendar,
  shopping: ShoppingBag,
  rent: Home,
  other: Receipt,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = categoryIconMap[category] || Receipt;
  return <Icon className={className} />;
}
