import { Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "./theme-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const { data: session } = authClient.useSession();

	return (
		<div className="border-border/40 border-b">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
				<div className="flex items-center space-x-8">
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
								<span>Dashboard</span>
							</Link>
						</nav>
					)}
				</div>
				<div className=" flex flex-row gap-2 ">
					<ThemeToggle />
					<UserMenu />
				</div>
			</div>
		</div>
	);
}
