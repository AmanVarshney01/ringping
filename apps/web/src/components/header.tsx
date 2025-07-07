import { Link } from "@tanstack/react-router";
import { Music } from "lucide-react";
import UserMenu from "./user-menu";

export default function Header() {
  return (
    <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Music className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg text-foreground">RingPing</span>
          </Link>
          
          <UserMenu />
        </div>
      </div>
    </div>
  );
}
