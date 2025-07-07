import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import z from "zod/v4";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  useEffect(() => {
    if (!isSessionPending && !session) {
      navigate({ to: "/login" });
    }
  }, [isSessionPending, session, navigate]);

  const ringtonesQuery = useQuery(
    orpc.ringtone.getAll.queryOptions({
      enabled: !!session,
    }),
  );

  const createMutation = useMutation(
    orpc.ringtone.create.mutationOptions({
      onSuccess: () => {
        toast.success("Ringtone created successfully!");
        queryClient.invalidateQueries({
          queryKey: orpc.ringtone.getAll.queryKey(),
        });
        form.reset();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      url: "",
      startTime: "00:00:00",
      endTime: "00:00:10",
      fileName: "ringtone",
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate(value);
    },
    validators: {
      onSubmit: z.object({
        url: z.string().url("Please enter a valid URL"),
        startTime: z
          .string()
          .regex(/^\\d{2}:\\d{2}:\\d{2}$/, "Invalid time format (HH:MM:SS)"),
        endTime: z
          .string()
          .regex(/^\\d{2}:\\d{2}:\\d{2}$/, "Invalid time format (HH:MM:SS)"),
        fileName: z.string().min(1, "File name cannot be empty"),
      }),
    },
  });

  if (isSessionPending || !session) {
    return <Loader />;
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <h1 className="mb-6 text-3xl font-bold">Welcome, {session.user.name}</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Create New Ringtone</CardTitle>
              <CardDescription>
                Enter a video URL and trim times to create a new ringtone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
                className="space-y-4"
              >
                <form.Field name="url">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Video URL</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      {field.state.meta.errors.map((error) => (
                        <p
                          key={error?.message}
                          className="text-red-500 text-sm"
                        >
                          {error?.message}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>

                <div className="grid grid-cols-2 gap-4">
                  <form.Field name="startTime">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>Start Time</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="text"
                          placeholder="HH:MM:SS"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p
                            key={error?.message}
                            className="text-red-500 text-sm"
                          >
                            {error?.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="endTime">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>End Time</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="text"
                          placeholder="HH:MM:SS"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p
                            key={error?.message}
                            className="text-red-500 text-sm"
                          >
                            {error?.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                </div>

                <form.Field name="fileName">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>File Name</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="text"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      {field.state.meta.errors.map((error) => (
                        <p
                          key={error?.message}
                          className="text-red-500 text-sm"
                        >
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
                      className="w-full"
                      disabled={!state.canSubmit || createMutation.isPending}
                    >
                      {createMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create Ringtone"
                      )}
                    </Button>
                  )}
                </form.Subscribe>
              </form>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Your Ringtones</CardTitle>
              <CardDescription>
                Here are the ringtones you've created.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ringtonesQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : ringtonesQuery.data?.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  You haven't created any ringtones yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {ringtonesQuery.data?.map((ringtone) => (
                    <li
                      key={ringtone.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="font-medium">{ringtone.fileName}.mp3</p>
                        <p className="text-muted-foreground text-sm">
                          {ringtone.startTime} - {ringtone.endTime}
                        </p>
                      </div>
                      <Button asChild>
                        <a
                          href={`${import.meta.env.VITE_SERVER_URL}${ringtone.downloadUrl}`}
                          download
                        >
                          Download
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
