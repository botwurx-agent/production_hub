// Contact categories (the "folders" a roster is organized into) and a curated
// list of positions per category, tuned for boutique commercial / food /
// beverage / CPG production. The Position field is a searchable combobox seeded
// from these but accepts free text, so nothing here is a hard constraint.

export type ContactCategory = "crew" | "talent" | "extras" | "vendor" | "client";

export const CATEGORIES: {
  key: ContactCategory;
  label: string;
  plural: string;
  hue: string;
}[] = [
  { key: "crew", label: "Crew", plural: "Crew", hue: "blue" },
  { key: "talent", label: "Talent", plural: "Talent", hue: "purple" },
  { key: "extras", label: "Extras", plural: "Extras", hue: "cyan" },
  { key: "vendor", label: "Vendor", plural: "Vendors", hue: "green" },
  { key: "client", label: "Client", plural: "Clients", hue: "orange" },
];

export const CATEGORY_HUE: Record<string, string> = {
  crew: "blue",
  talent: "purple",
  extras: "cyan",
  vendor: "green",
  client: "orange",
};

export function categoryLabel(type: string | null | undefined): string {
  return CATEGORIES.find((c) => c.key === type)?.label ?? "Crew";
}

export function normalizeCategory(type: string | null | undefined): ContactCategory {
  return (CATEGORIES.find((c) => c.key === type)?.key ?? "crew") as ContactCategory;
}

export const POSITIONS: Record<ContactCategory, string[]> = {
  crew: [
    "Director",
    "Executive Producer",
    "Producer",
    "Line Producer",
    "Production Manager",
    "Production Coordinator",
    "1st Assistant Director",
    "2nd Assistant Director",
    "Director of Photography",
    "Camera Operator",
    "1st AC (Focus Puller)",
    "2nd AC",
    "DIT",
    "Steadicam Operator",
    "Gaffer",
    "Best Boy Electric",
    "Electrician",
    "Key Grip",
    "Best Boy Grip",
    "Grip",
    "Dolly Grip",
    "Sound Mixer",
    "Boom Operator",
    "Production Designer",
    "Art Director",
    "Set Decorator",
    "Set Dresser",
    "Prop Master",
    "Prop Stylist",
    "Food Stylist",
    "Food Stylist Assistant",
    "Home Economist",
    "Wardrobe Stylist",
    "Costume Designer",
    "Hair & Makeup Artist",
    "Groomer",
    "Script Supervisor",
    "Location Manager",
    "Location Scout",
    "Casting Director",
    "Production Assistant",
    "Craft Services",
    "Editor",
    "Assistant Editor",
    "Colorist",
    "VFX Artist",
    "Motion Designer",
    "Retoucher",
    "Composer",
    "Sound Designer",
    "Photographer",
    "BTS / Stills",
  ],
  talent: [
    "Lead Talent",
    "Supporting Talent",
    "Featured Talent",
    "Hand Model",
    "Product Model",
    "Spokesperson",
    "Presenter",
    "Voice Over",
    "Narrator",
    "Dancer",
    "Musician",
    "Child Talent",
  ],
  extras: [
    "Background",
    "Featured Extra",
    "Stand-in",
    "Photo Double",
    "Silent Bit",
  ],
  vendor: [
    "CGI / 3D Studio",
    "VFX Studio",
    "VFX Supervisor",
    "3D Generalist",
    "Modeler",
    "Animator",
    "Lighting / Render",
    "Compositor",
    "Matte Painter",
    "Motion Graphics",
    "AI Generation Vendor",
    "Post House",
    "Editorial",
    "Color House",
    "Retoucher",
    "Sound Studio",
    "Composer",
    "Sound Design",
    "Mix Engineer",
    "Music Licensing",
    "Stock Footage",
    "Camera Rental",
    "Lighting & Grip Rental",
    "Studio / Stage Rental",
    "Equipment Rental",
    "Catering",
    "Transportation",
    "Insurance",
    "Permits",
    "Translation / Subtitles",
  ],
  client: [
    "Brand Manager",
    "Marketing Director",
    "Marketing Manager",
    "Brand Contact",
    "Creative Director",
    "Art Director (Agency)",
    "Copywriter",
    "Account Director",
    "Account Manager",
    "Agency Producer",
    "Agency Contact",
    "Founder / Owner",
  ],
};
