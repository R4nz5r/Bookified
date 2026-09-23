"use client";

import { Mic, MicOff, PhoneOff } from "lucide-react";
import useVapi from "@/hooks/useVapi";
import { IBook } from "@/types";
import Image from "next/image";
import Transcript from "@/components/Transcript";
import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const VapiControls = ({ book }: { book: IBook }) => {
  const {
    status,
    isActive,
    isMuted,
    toggleMute,
    messages,
    currentMessage,
    currentUserMessage,
    duration,
    start,
    stop,
    clearError,
    limitError,
    isBillingError,
    maxDurationSeconds,
  } = useVapi(book);
  const router = useRouter();

  useEffect(() => {
    if (limitError) {
      toast.error(limitError);
      if (isBillingError) {
        router.push("/subscriptions");
      }
      clearError();
    }
  }, [isBillingError, limitError, router, clearError]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusDisplay = () => {
    if (isActive && isMuted) {
      return { label: "Muted", color: "bg-amber-500" };
    }
    switch (status) {
      case "connecting":
        return { label: "Connecting...", color: "vapi-status-dot-connecting" };
      case "starting":
        return { label: "Starting...", color: "vapi-status-dot-starting" };
      case "listening":
        return { label: "Listening", color: "vapi-status-dot-listening" };
      case "thinking":
        return { label: "Thinking...", color: "vapi-status-dot-thinking" };
      case "speaking":
        return { label: "Speaking", color: "vapi-status-dot-speaking" };
      default:
        return { label: "Ready", color: "vapi-status-dot-ready" };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <>
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        {/* Header Card */}
        <div className="vapi-header-card">
          <div className="vapi-cover-wrapper">
            <Image
              src={book.coverURL || "/assets/book-cover.svg"}
              alt={book.title}
              width={120}
              height={180}
              className="vapi-cover-image !w-[120px] !h-auto"
              priority
            />
            <div className="vapi-mic-wrapper relative">
              {isActive && !isMuted && (status === "speaking" || status === "thinking") && (
                <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (isActive) {
                    stop();
                  } else {
                    start();
                  }
                }}
                disabled={status === "connecting"}
                aria-label={
                  !isActive
                    ? "Start voice call"
                    : "End voice call"
                }
                title={
                  !isActive
                    ? "Start voice call"
                    : "Click to stop voice call"
                }
                className={`vapi-mic-btn shadow-md !w-[60px] !h-[60px] z-10 transition-all ${
                  !isActive
                    ? "vapi-mic-btn-inactive"
                    : isMuted
                    ? "!bg-amber-500 hover:!bg-amber-600"
                    : "vapi-mic-btn-active"
                }`}
              >
                {!isActive ? (
                  <MicOff className="size-7 text-[#212a3b]" />
                ) : isMuted ? (
                  <MicOff className="size-7 text-white" />
                ) : (
                  <Mic className="size-7 text-white" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#212a3b] mb-1">
                {book.title}
              </h1>
              <p className="text-[#3d485e] font-medium">by {book.author}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="vapi-status-indicator">
                <span className={`vapi-status-dot ${statusDisplay.color}`} />
                <span className="vapi-status-text">{statusDisplay.label}</span>
              </div>

              <div className="vapi-status-indicator">
                <span className="vapi-status-text">
                  Voice: {book.persona || "Daniel"}
                </span>
              </div>

              <div className="vapi-status-indicator">
                <span className="vapi-status-text">
                  {formatDuration(duration)}/
                  {formatDuration(maxDurationSeconds)}
                </span>
              </div>

              {isActive && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      toggleMute();
                    }}
                    className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-[4px] shadow-sm transition-all cursor-pointer ${
                      isMuted
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-white/80 hover:bg-white text-[#212a3b] border border-black/10"
                    }`}
                    title={isMuted ? "Click to unmute microphone" : "Click to mute microphone"}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="size-3.5" />
                        <span>Unmute</span>
                      </>
                    ) : (
                      <>
                        <Mic className="size-3.5" />
                        <span>Mute</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      stop();
                    }}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-[4px] shadow-sm transition-all cursor-pointer"
                    title="End voice conversation"
                  >
                    <PhoneOff className="size-3.5" />
                    <span>End Call</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="vapi-transcript-wrapper">
          <div className="transcript-container min-h-[400px]">
            <Transcript
              messages={messages}
              currentMessage={currentMessage}
              currentUserMessage={currentUserMessage}
            />
          </div>
        </div>
      </div>
    </>
  );
};
export default VapiControls;
