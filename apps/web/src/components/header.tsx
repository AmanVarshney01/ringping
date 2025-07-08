import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Music } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import UserMenu from "./user-menu";

export default function Header() {
	const { data: session } = authClient.useSession();

	return (
		<div className="border-border/40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container mx-auto max-w-7xl">
				<div className="flex h-16 items-center justify-between px-4">
					<div className="flex items-center space-x-8">
						<Link
							to="/"
							className="flex items-center space-x-2 transition-opacity hover:opacity-80"
						>
							<Music className="h-6 w-6 text-primary" />
							<span className="font-semibold text-foreground text-lg">
								RingPing
							</span>
						</Link>

						{session && (
							<nav className="flex items-center space-x-6">
								<Link
									to="/"
									className="font-medium text-foreground transition-colors hover:text-primary"
									activeProps={{
										className: "text-primary",
									}}
								>
									Create
								</Link>
								<Link
									to="/dashboard"
									className="flex items-center space-x-2 font-medium text-foreground transition-colors hover:text-primary"
									activeProps={{
										className: "text-primary",
									}}
								>
									<LayoutDashboard className="h-4 w-4" />
									<span>Dashboard</span>
								</Link>
							</nav>
						)}
					</div>

					<UserMenu />
				</div>
			</div>
		</div>
	);
}
