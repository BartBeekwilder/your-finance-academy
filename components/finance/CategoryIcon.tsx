import {
  Banknote, Bike, Book, Briefcase, BriefcaseMedical, Bus, Cake, Car, ChartLine, ChartPie,
  CircleDollarSign, CircleHelp, CircleParking, Coffee, CreditCard, CupSoda, Droplet, Dumbbell,
  Ellipsis, Film, Flame, Fuel, Gamepad2, Gift, GraduationCap, Heart, House, Leaf, Music, PawPrint,
  Percent, Phone, Pill, Plane, Receipt, Shirt, ShoppingBag, ShoppingCart, Star, Stethoscope,
  TramFront, Tv, Users, Utensils, Wallet, Wifi, Wine, Wrench, Zap, type LucideIcon,
} from "lucide-react";

// iOS stores SF Symbol names (Services/IconLibrary.swift). The web has no SF
// Symbols, so each one maps to its closest lucide icon. Unknown names fall
// back to a question mark, same as the iOS default.
const SF_TO_WEB: Record<string, LucideIcon> = {
  airplane: Plane,
  "bag.fill": ShoppingBag,
  "banknote.fill": Banknote,
  bicycle: Bike,
  "birthday.cake.fill": Cake,
  "bolt.fill": Zap,
  "book.fill": Book,
  "briefcase.fill": Briefcase,
  "bus.fill": Bus,
  "car.fill": Car,
  "cart.fill": ShoppingCart,
  "chart.line.uptrend.xyaxis": ChartLine,
  "chart.pie.fill": ChartPie,
  "creditcard.fill": CreditCard,
  "cross.case.fill": BriefcaseMedical,
  "cup.and.saucer.fill": Coffee,
  "dollarsign.circle.fill": CircleDollarSign,
  "drop.fill": Droplet,
  "dumbbell.fill": Dumbbell,
  "ellipsis.circle.fill": Ellipsis,
  "film.fill": Film,
  "flame.fill": Flame,
  "fork.knife": Utensils,
  "fuelpump.fill": Fuel,
  "gamecontroller.fill": Gamepad2,
  "gift.fill": Gift,
  "graduationcap.fill": GraduationCap,
  "heart.fill": Heart,
  "house.fill": House,
  "leaf.fill": Leaf,
  "music.note": Music,
  "parkingsign.circle.fill": CircleParking,
  "pawprint.fill": PawPrint,
  percent: Percent,
  "person.2.fill": Users,
  "phone.fill": Phone,
  "pills.fill": Pill,
  "questionmark.circle.fill": CircleHelp,
  "receipt.fill": Receipt,
  "star.fill": Star,
  stethoscope: Stethoscope,
  "takeoutbag.and.cup.and.straw.fill": CupSoda,
  "tram.fill": TramFront,
  "tshirt.fill": Shirt,
  "tv.fill": Tv,
  "wallet.pass.fill": Wallet,
  wifi: Wifi,
  "wineglass.fill": Wine,
  "wrench.and.screwdriver.fill": Wrench,
};

/** The colored rounded-square badge iOS uses in every category row. */
export default function CategoryIcon({
  icon,
  colorHex,
  size = 32,
}: {
  icon: string;
  colorHex: string;
  size?: number;
}) {
  const Icon = SF_TO_WEB[icon] ?? CircleHelp;
  return (
    <span
      className="pf-badge"
      style={{ width: size, height: size, background: `#${colorHex}`, borderRadius: size * 0.28 }}
      aria-hidden
    >
      <Icon size={size * 0.55} strokeWidth={2.2} color="white" />
    </span>
  );
}
