import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Loader2, Music, Plus, Play, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod/v4";
import { TimePicker } from "@/components/time-picker";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
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
  
  const [videoUrl, setVideoUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<{
    title: string;
    duration: number;
    thumbnail: string | null;
    uploader: string;
  } | null>(null);

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

  const videoInfoMutation = useMutation(
    orpc.ringtone.getVideoInfo.mutationOptions({
      onSuccess: (data) => {
        setVideoInfo(data);
        toast.success(`Video found: ${data.title}`);
      },
      onError: (error) => {
        setVideoInfo(null);
        toast.error(error.message);
      },
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
        setVideoInfo(null);
        setVideoUrl("");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const convertTimeStringToSeconds = (timeString: string) => {
    const [hours, minutes, seconds] = timeString.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const form = useForm({
    defaultValues: {
      url: "",
      startTime: "00:00:00",
      endTime: "00:00:10",
      fileName: "ringtone",
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate({
        ...value,
        videoDuration: videoInfo?.duration,
      });
    },
    validators: {
      onSubmit: z
        .object({
          url: z.string().url("Please enter a valid URL"),
          startTime: z
            .string()
            .regex(
              /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/,
              "Invalid time format (HH:MM:SS)",
            ),
          endTime: z
            .string()
            .regex(
              /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/,
              "Invalid time format (HH:MM:SS)",
            ),
          fileName: z
            .string()
            .min(1, "File name cannot be empty")
            .refine((name) => !/[<>:"/\\|?*]/.test(name), {
              message: "File name contains invalid characters",
            }),
        })
        .refine(
          (data) => {
            const startSeconds = convertTimeStringToSeconds(data.startTime);
            const endSeconds = convertTimeStringToSeconds(data.endTime);
            return endSeconds > startSeconds;
          },
          {
            message: "End time must be after start time",
            path: ["endTime"],
          },
        )
        .refine(
          (data) => {
            const startSeconds = convertTimeStringToSeconds(data.startTime);
            const endSeconds = convertTimeStringToSeconds(data.endTime);
            return endSeconds - startSeconds <= 60;
          },
          {
            message: "Ringtone duration should be 60 seconds or less",
            path: ["endTime"],
          },
        )
        .refine(
          (data) => {
            if (!videoInfo?.duration) return true;
            const endSeconds = convertTimeStringToSeconds(data.endTime);
            return endSeconds <= videoInfo.duration;
          },
          {
            message: videoInfo?.duration 
              ? `End time cannot exceed video duration (${formatDuration(videoInfo.duration)})`
              : "End time exceeds video duration",
            path: ["endTime"],
          },
        )
        .refine(
          (data) => {
            if (!videoInfo?.duration) return true;
            const startSeconds = convertTimeStringToSeconds(data.startTime);
            return startSeconds <= videoInfo.duration;
          },
          {
            message: videoInfo?.duration 
              ? `Start time cannot exceed video duration (${formatDuration(videoInfo.duration)})`
              : "Start time exceeds video duration",
            path: ["startTime"],
          },
        ),
    },
  });

  const handleUrlChange = (url: string) => {
    setVideoUrl(url);
    form.setFieldValue("url", url);
    
    if (!url.trim()) {
      setVideoInfo(null);
      return;
    }

    try {
      new URL(url);
      const timeoutId = setTimeout(() => {
        videoInfoMutation.mutate({ url });
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } catch {
      setVideoInfo(null);
    }
  };

  if (isSessionPending || !session) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Music className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-light text-foreground mb-2">
            Create Ringtones
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 mb-12 shadow-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
            className="space-y-8"
          >
            <form.Field name="url">
              {(field) => (
                <div className="space-y-3">
                  <Label htmlFor={field.name} className="text-base font-medium">
                    Video URL
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onBlur={field.handleBlur}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="h-12 text-base"
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-red-500 text-sm">
                      {error?.message}
                    </p>
                  ))}

                  {videoInfoMutation.isPending && (
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Fetching video info...</span>
                    </div>
                  )}
                </div>
              )}
            </form.Field>

            {videoInfo && (
              <div className="bg-muted/20 border border-border rounded-lg p-4">
                <div className="flex items-start space-x-4">
                  {videoInfo.thumbnail && (
                    <img
                      src={videoInfo.thumbnail}
                      alt="Video thumbnail"
                      className="w-20 h-15 object-cover rounded-md"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <Play className="h-4 w-4 text-primary" />
                      <h3 className="font-medium text-foreground truncate">
                        {videoInfo.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      By {videoInfo.uploader}
                    </p>
                    <p className="text-sm font-medium text-primary">
                      Duration: {formatDuration(videoInfo.duration)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {videoInfo && videoInfo.duration < 30 && (
              <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This video is quite short ({formatDuration(videoInfo.duration)}). Make sure your ringtone times fit within this duration.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <form.Field name="startTime">
                {(field) => (
                  <div className="space-y-3">
                    <TimePicker
                      id={field.name}
                      label="Start Time"
                      value={field.state.value}
                      onChange={field.handleChange}
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
                  <div className="space-y-3">
                    <TimePicker
                      id={field.name}
                      label="End Time"
                      value={field.state.value}
                      onChange={field.handleChange}
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
                <div className="space-y-3">
                  <Label htmlFor={field.name} className="text-base font-medium">
                    File Name
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="text"
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
                  className="w-full h-12 text-base font-medium"
                  disabled={!state.canSubmit || createMutation.isPending || !videoInfo}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-5 w-5 mr-2" />
                  )}
                  {createMutation.isPending ? "Creating..." : "Create Ringtone"}
                </Button>
              )}
            </form.Subscribe>
            
            {!videoInfo && videoUrl && !videoInfoMutation.isPending && (
              <p className="text-center text-sm text-muted-foreground">
                Please enter a valid video URL to continue
              </p>
            )}
          </form>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-light text-foreground">Your Ringtones</h2>
          
          {ringtonesQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : ringtonesQuery.data?.length === 0 ? (
            <div className="text-center py-12">
              <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                No ringtones yet. Create your first one above!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ringtonesQuery.data?.map((ringtone) => (
                <div
                  key={ringtone.id}
                  className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Music className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">
                        {ringtone.fileName}.mp3
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ringtone.startTime} → {ringtone.endTime}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="shrink-0"
                  >
                    <a
                      href={`${import.meta.env.VITE_SERVER_URL}${ringtone.downloadUrl}`}
                      download
                      target="_blank"
                      className="flex items-center"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
