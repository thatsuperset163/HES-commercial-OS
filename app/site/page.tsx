import type { Metadata } from "next";
import SiteApp from "@/app/SiteApp";
import "./site.css";

export const metadata: Metadata = {
  title: "Harris Exterior Solutions",
  description:
    "Pressure washing, window cleaning, and junk removal for homes and commercial properties.",
};

export default function SitePage() {
  return <SiteApp />;
}
