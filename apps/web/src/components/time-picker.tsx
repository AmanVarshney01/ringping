import * as React from "react";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";

type TimePickerProps = {
  value: string; // in HH:MM:SS format
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  id?: string;
};

export const TimePicker = ({
  value = "00:00:00",
  onChange,
  label,
  className,
  id,
}: TimePickerProps) => {
  const [hours, setHours] = React.useState(() => {
    const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    return match ? Number.parseInt(match[1], 10) : 0;
  });

  const [minutes, setMinutes] = React.useState(() => {
    const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    return match ? Number.parseInt(match[2], 10) : 0;
  });

  const [seconds, setSeconds] = React.useState(() => {
    const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    return match ? Number.parseInt(match[3], 10) : 0;
  });

  React.useEffect(() => {
    const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      setHours(Number.parseInt(match[1], 10));
      setMinutes(Number.parseInt(match[2], 10));
      setSeconds(Number.parseInt(match[3], 10));
    }
  }, [value]);

  React.useEffect(() => {
    const formattedValue = [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      seconds.toString().padStart(2, "0"),
    ].join(":");
    onChange(formattedValue);
  }, [hours, minutes, seconds, onChange]);

  const handleInputChange = (
    newValue: string,
    setter: (value: number) => void,
    max: number
  ) => {
    const num = Number.parseInt(newValue, 10);
    if (!isNaN(num) && num >= 0 && num <= max) {
      setter(num);
    } else if (newValue === "") {
      setter(0);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: "hours" | "minutes" | "seconds",
    current: number,
    setter: (value: number) => void,
    max: number
  ) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setter(current >= max ? (type === "hours" ? max : 0) : current + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setter(current <= 0 ? (type === "hours" ? 0 : max) : current - 1);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      )}
      
      <div className="flex items-center justify-center space-x-2">
        <div className="flex flex-col items-center space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Hours</span>
          <input
            type="number"
            min="0"
            max="23"
            value={hours.toString().padStart(2, "0")}
            onChange={(e) => handleInputChange(e.target.value, setHours, 23)}
            onKeyDown={(e) => handleKeyDown(e, "hours", hours, setHours, 23)}
            className={cn(
              "w-16 h-12 text-center text-lg font-mono font-semibold",
              "border border-border rounded-lg bg-background",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "hover:border-muted-foreground transition-colors",
              "appearance-none"
            )}
            id={`${id}-hours`}
            aria-label="Hours"
          />
        </div>

        <span className="text-2xl font-mono text-muted-foreground mt-6">:</span>

        <div className="flex flex-col items-center space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Minutes</span>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes.toString().padStart(2, "0")}
            onChange={(e) => handleInputChange(e.target.value, setMinutes, 59)}
            onKeyDown={(e) => handleKeyDown(e, "minutes", minutes, setMinutes, 59)}
            className={cn(
              "w-16 h-12 text-center text-lg font-mono font-semibold",
              "border border-border rounded-lg bg-background",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "hover:border-muted-foreground transition-colors",
              "appearance-none"
            )}
            id={`${id}-minutes`}
            aria-label="Minutes"
          />
        </div>

        <span className="text-2xl font-mono text-muted-foreground mt-6">:</span>

        <div className="flex flex-col items-center space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Seconds</span>
          <input
            type="number"
            min="0"
            max="59"
            value={seconds.toString().padStart(2, "0")}
            onChange={(e) => handleInputChange(e.target.value, setSeconds, 59)}
            onKeyDown={(e) => handleKeyDown(e, "seconds", seconds, setSeconds, 59)}
            className={cn(
              "w-16 h-12 text-center text-lg font-mono font-semibold",
              "border border-border rounded-lg bg-background",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "hover:border-muted-foreground transition-colors",
              "appearance-none"
            )}
            id={`${id}-seconds`}
            aria-label="Seconds"
          />
        </div>
      </div>

        <style jsx>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
};
