import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod/v4";
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
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard")({
  component: RingtoneRoute,
});

function RingtoneRoute() {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const createMutation = useMutation(
    orpc.ringtone.create.mutationOptions({
      onSuccess: (data) => {
        setDownloadUrl(data.downloadUrl);
        toast.success("Ringtone created successfully!");
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
      setDownloadUrl(null);
      createMutation.mutate(value);
    },
    validators: {
      onSubmit: z.object({
        url: z.string().url("Please enter a valid URL"),
        startTime: z
          .string()
          .regex(/^\d{2}:\d{2}:\d{2}$/, "Invalid time format (HH:MM:SS)"),
        endTime: z
          .string()
          .regex(/^\d{2}:\d{2}:\d{2}$/, "Invalid time format (HH:MM:SS)"),
        fileName: z.string().min(1, "File name cannot be empty"),
      }),
    },
  });

  return (
    <div className="mx-auto w-full max-w-md py-10">
      <Card>
        <CardHeader>
          <CardTitle>Ringtone Maker</CardTitle>
          <CardDescription>Create a ringtone from a video URL.</CardDescription>
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
                    <p key={error?.message} className="text-red-500 text-sm">
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
                      <p key={error?.message} className="text-red-500 text-sm">
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
                      <p key={error?.message} className="text-red-500 text-sm">
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

          {downloadUrl && (
            <div className="mt-6 text-center">
              <Button asChild>
                <a
                  href={`${import.meta.env.VITE_SERVER_URL}${downloadUrl}`}
                  download
                >
                  Download Ringtone
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
