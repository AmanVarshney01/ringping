import { Link } from "@tanstack/react-router";
import { Music } from "lucide-react";
import UserMenu from "./user-menu";

export default function Header() {
	return (
		<div className="border-border/40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container mx-auto max-w-7xl">
				<div className="flex h-16 items-center justify-between px-4">
					<Link
						to="/"
						className="flex items-center space-x-2 transition-opacity hover:opacity-80"
					>
						<Music className="h-6 w-6 text-primary" />
						<span className="font-semibold text-foreground text-lg">
							RingPing
						</span>
					</Link>

					<UserMenu />
				</div>
			</div>
		</div>
	);
}
