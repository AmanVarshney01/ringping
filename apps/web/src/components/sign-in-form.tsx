import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { LogIn, Music } from "lucide-react";
import { toast } from "sonner";
import z from "zod/v4";
import { authClient } from "@/lib/auth-client";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						navigate({
							to: "/",
						});
						toast.success("Welcome back!");
					},
					onError: (error) => {
						toast.error(error.error.message);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<div className="w-full max-w-md">
				{/* Header */}
				<div className="mb-8 text-center">
					<div className="mb-4 flex justify-center">
						<Music className="h-8 w-8 text-primary" />
					</div>
					<h1 className="mb-2 font-light text-2xl text-foreground">
						Welcome Back
					</h1>
					<p className="text-muted-foreground">Sign in to your account</p>
				</div>

				{/* Form */}
				<div className="rounded-xl border border-border bg-card p-8 shadow-sm">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							void form.handleSubmit();
						}}
						className="space-y-6"
					>
						<form.Field name="email">
							{(field) => (
								<div className="space-y-3">
									<Label htmlFor={field.name} className="font-medium text-base">
										Email
									</Label>
									<Input
										id={field.name}
										name={field.name}
										type="email"
										placeholder="Enter your email"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										className="h-12 text-base"
									/>
									{field.state.meta.errors.map((error) => (
										<p key={error?.message} className="text-red-500 text-sm">
											{error?.message}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Field name="password">
							{(field) => (
								<div className="space-y-3">
									<Label htmlFor={field.name} className="font-medium text-base">
										Password
									</Label>
									<Input
										id={field.name}
										name={field.name}
										type="password"
										placeholder="Enter your password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										className="h-12 text-base"
									/>
									{field.state.meta.errors.map((error) => (
										<p key={error?.message} className="text-red-500 text-sm">
											{error?.message}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Subscribe>
							{(state) => (
								<Button
									type="submit"
									className="h-12 w-full font-medium text-base"
									disabled={!state.canSubmit || state.isSubmitting}
								>
									{state.isSubmitting ? (
										<>
											<Music className="mr-2 h-5 w-5 animate-spin" />
											Signing in...
										</>
									) : (
										<>
											<LogIn className="mr-2 h-5 w-5" />
											Sign In
										</>
									)}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</div>

				{/* Switch to Sign Up */}
				<div className="mt-6 text-center">
					<p className="text-muted-foreground">
						Don't have an account?{" "}
						<button
							type="button"
							onClick={onSwitchToSignUp}
							className="font-medium text-primary hover:underline"
						>
							Sign up
						</button>
					</p>
				</div>
			</div>
		</div>
	);
}
