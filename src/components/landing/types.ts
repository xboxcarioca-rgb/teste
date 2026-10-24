export interface FeatureItem {
  title: string;
  description: string;
  icon: "zap" | "sliders" | "package" | "shield" | "save" | "printer";
}

export interface TestimonialItem {
  name: string;
  role: string;
  avatar: string;
  quote: string;
}

export interface StepItem {
  title: string;
  description: string;
  icon: "upload" | "adjustments" | "download";
}

export interface PricingOption {
  billing: "mensal" | "anual";
  label: string;
  price: string;
  cadence: string;
  badge?: string;
  summary: string;
  checkoutHref: string;
  benefits: string[];
}

export interface DemoAsset {
  title: string;
  subtitle: string;
  src: string;
  alt: string;
  downloadName?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}
