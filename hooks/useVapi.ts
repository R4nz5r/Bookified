"use client";

// Create hooks/useVapi.ts: the core hook. Initializes Vapi SDK, manages call lifecycle (idle, connecting, starting, listening, thinking, speaking), tracks messages array + currentMessage streaming, handles duration timer with maxDuration enforcement, session tracking via server actions

import { useState, useEffect, useRef, useCallback } from "react";
import Vapi from "@vapi-ai/web";
import { useAuth } from "@clerk/nextjs";

import { useSubscription } from "@/hooks/useSubscription";
import { ASSISTANT_ID, DEFAULT_VOICE, VOICE_SETTINGS } from "@/lib/constants";
import { getVoice } from "@/lib/utils";
import { IBook, Messages } from "@/types";
import {
  startVoiceSession,
  endVoiceSession,
} from "@/lib/actions/session.actions";

export function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const TIMER_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const TIME_WARNING_THRESHOLD = 60; // Show warning when this many seconds remain

let vapi: InstanceType<typeof Vapi>;
function getVapi() {
  if (!vapi) {
    if (!VAPI_API_KEY) {
      throw new Error(
        "NEXT_PUBLIC_VAPI_API_KEY environment variable is not set",
      );
    }
    vapi = new Vapi(VAPI_API_KEY);
  }
  return vapi;
}

export type CallStatus =
  | "idle"
  | "connecting"
  | "starting"
  | "listening"
  | "thinking"
  | "speaking";

export function useVapi(book: IBook) {
  const { userId } = useAuth();
  const { limits } = useSubscription();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [messages, setMessages] = useState<Messages[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [currentUserMessage, setCurrentUserMessage] = useState("");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [isBillingError, setIsBillingError] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);

  // Keep refs in sync with latest values for use in callbacks
  const maxDurationSeconds = limits?.maxDurationPerSession
    ? limits.maxDurationPerSession * 60
    : 15 * 60;
  const maxDurationRef = useLatestRef(maxDurationSeconds);
  const durationRef = useLatestRef(duration);
  const messagesRef = useLatestRef(messages);
  const voice = book.persona || DEFAULT_VOICE;

  // Set up Vapi event listeners
  useEffect(() => {
    // Suppress Daily.co / WebRTC room ejection errors when teardown occurs
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = String(
        event?.reason?.message ||
          event?.reason?.msg ||
          event?.reason ||
          "",
      ).toLowerCase();

      if (
        reason.includes("meeting ended") ||
        reason.includes("meeting has ended") ||
        reason.includes("ejection") ||
        reason.includes("left the call")
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    const handlers = {
      "call-start": () => {
        isStoppingRef.current = false;
        setIsMuted(false);
        setStatus("starting"); // AI speaks first, wait for it
        setCurrentMessage("");
        setCurrentUserMessage("");

        // If resuming a session with previous messages, inject context into Vapi's active session
        if (messagesRef.current && messagesRef.current.length > 0) {
          const recentMsgs = messagesRef.current.slice(-10);
          const historySummary = recentMsgs
            .map(
              (m) =>
                `${m.role === "user" ? "Reader" : "Assistant"}: ${m.content}`,
            )
            .join("\n");

          try {
            getVapi().send({
              type: "add-message",
              message: {
                role: "system",
                content: `You are continuing an ongoing conversation with this reader about the book "${book.title}" by ${book.author}. The reader previously paused and has now resumed the call. Here is the transcript of what was discussed immediately before resuming:\n\n${historySummary}\n\nContinue naturally from this context. Do not repeat introductions or re-ask if they have read the book.`,
              },
              triggerResponseEnabled: false,
            });
          } catch (e) {
            console.warn("Could not inject context into Vapi session:", e);
          }
        }

        // Start duration timer
        startTimeRef.current = Date.now();
        setDuration(0);
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            const newDuration = Math.floor(
              (Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS,
            );
            setDuration(newDuration);

            // Check duration limit
            if (newDuration >= maxDurationRef.current) {
              isStoppingRef.current = true;
              getVapi().stop().catch(() => {});
              setLimitError(
                `Session time limit (${Math.floor(
                  maxDurationRef.current / SECONDS_PER_MINUTE,
                )} minutes) reached. Upgrade your plan for longer sessions.`,
              );
            }
          }
        }, TIMER_INTERVAL_MS);
      },

      "call-end": () => {
        setIsMuted(false);
        setStatus("idle");
        setCurrentMessage("");
        setCurrentUserMessage("");

        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // End session tracking
        if (sessionIdRef.current) {
          endVoiceSession(sessionIdRef.current, durationRef.current).catch(
            (err) => console.error("Failed to end voice session:", err),
          );
          sessionIdRef.current = null;
        }

        startTimeRef.current = null;
      },

      "speech-start": () => {
        if (!isStoppingRef.current) {
          setStatus("speaking");
        }
      },
      "speech-end": () => {
        if (!isStoppingRef.current) {
          // After AI finishes speaking, user can talk
          setStatus("listening");
        }
      },

      message: (message: {
        type: string;
        role: string;
        transcriptType: string;
        transcript: string;
      }) => {
        if (message.type !== "transcript") return;

        // User finished speaking → AI is thinking
        if (message.role === "user" && message.transcriptType === "final") {
          if (!isStoppingRef.current) {
            setStatus("thinking");
          }
          setCurrentUserMessage("");
        }

        // Partial user transcript → show real-time typing
        if (message.role === "user" && message.transcriptType === "partial") {
          setCurrentUserMessage(message.transcript);
          return;
        }

        // Partial AI transcript → show word-by-word
        if (
          message.role === "assistant" &&
          message.transcriptType === "partial"
        ) {
          setCurrentMessage(message.transcript);
          return;
        }

        // Final transcript → add to messages
        if (message.transcriptType === "final") {
          if (message.role === "assistant") setCurrentMessage("");
          if (message.role === "user") setCurrentUserMessage("");

          setMessages((prev) => {
            const isDupe = prev.some(
              (m) =>
                m.role === message.role && m.content === message.transcript,
            );
            return isDupe
              ? prev
              : [...prev, { role: message.role, content: message.transcript }];
          });
        }
      },

      error: (error: any) => {
        setStatus("idle");
        setIsMuted(false);
        setCurrentMessage("");
        setCurrentUserMessage("");

        // Stop timer on error
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // End session tracking on error
        if (sessionIdRef.current) {
          endVoiceSession(sessionIdRef.current, durationRef.current).catch(
            (err) =>
              console.error("Failed to end voice session on error:", err),
          );
          sessionIdRef.current = null;
        }

        startTimeRef.current = null;

        // If the user intentionally stopped the call, do not treat as an error or log
        if (isStoppingRef.current) {
          return;
        }

        // Extract error message from various possible error object shapes
        const errObj = error?.error || error;
        const errorMessage = String(
          errObj?.msg ||
            errObj?.message?.msg ||
            errObj?.message ||
            errObj?.error?.msg ||
            error?.message ||
            error?.errorMsg ||
            errObj?.errorMsg ||
            "",
        ).toLowerCase();

        const errType = String(
          errObj?.type ||
            errObj?.error?.type ||
            error?.type ||
            "",
        ).toLowerCase();

        // Normal meeting completion or ejection after teardown should not trigger error alerts or logs
        if (
          !errorMessage ||
          errorMessage === "{}" ||
          errorMessage === "[object object]" ||
          errorMessage.includes("meeting has ended") ||
          errorMessage.includes("meeting ended") ||
          errorMessage.includes("ejected") ||
          errorMessage.includes("left the call") ||
          errType === "ejected" ||
          (errType === "daily-error" && errorMessage.includes("meeting"))
        ) {
          return;
        }

        console.error("Vapi error:", error);

        // Show user-friendly error message for genuine errors
        if (
          errorMessage.includes("timeout") ||
          errorMessage.includes("silence")
        ) {
          setLimitError(
            "Session ended due to inactivity. Click the mic to start again.",
          );
        } else if (
          errorMessage.includes("network") ||
          errorMessage.includes("connection")
        ) {
          setLimitError(
            "Connection lost. Please check your internet and try again.",
          );
        } else {
          setLimitError(
            "Session ended. Click the mic to start again.",
          );
        }
      },
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      getVapi().on(event as keyof typeof handlers, handler as () => void);
    });

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      // End active session on unmount
      if (sessionIdRef.current) {
        try {
          getVapi().stop().catch(() => {});
        } catch {
          // Ignore
        }
        endVoiceSession(sessionIdRef.current, durationRef.current).catch(
          (err) =>
            console.error("Failed to end voice session on unmount:", err),
        );
        sessionIdRef.current = null;
      }
      // Cleanup handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        getVapi().off(event as keyof typeof handlers, handler as () => void);
      });
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = useCallback(async () => {
    if (!userId) {
      setLimitError("Please sign in to start a voice session.");
      return;
    }

    setLimitError(null);
    setIsBillingError(false);
    setStatus("connecting");

    try {
      // Check session limits and create session record
      const result = await startVoiceSession(userId, book._id);

      if (!result.success) {
        setLimitError(
          result.error || "Session limit reached. Please upgrade your plan.",
        );
        setIsBillingError(!!result.isBillingError);
        setStatus("idle");
        return;
      }

      sessionIdRef.current = result.sessionId || null;

      const prevMsgs =
        messagesRef.current && messagesRef.current.length > 0
          ? messagesRef.current
          : messages;
      const hasHistory = prevMsgs.length > 0;
      const firstMessage = hasHistory
        ? `Welcome back! Let's pick up where we left off with ${book.title}. What would you like to explore next?`
        : `Hey, good to meet you. Quick question before we dive in - have you actually read ${book.title} yet, or are we starting fresh?`;

      const recentContext = hasHistory
        ? prevMsgs
            .slice(-8)
            .map(
              (m) =>
                `${m.role === "user" ? "Reader" : "Assistant"}: ${m.content}`,
            )
            .join("\n")
        : "";

      await getVapi().start(ASSISTANT_ID, {
        firstMessage,
        variableValues: {
          title: book.title,
          author: book.author,
          bookId: book._id,
          ...(recentContext ? { previousConversation: recentContext } : {}),
        },
        voice: {
          provider: "11labs" as const,
          voiceId: getVoice(voice).id,
          model: "eleven_turbo_v2_5" as const,
          stability: VOICE_SETTINGS.stability,
          similarityBoost: VOICE_SETTINGS.similarityBoost,
          style: VOICE_SETTINGS.style,
          useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
        },
      });
    } catch (err) {
      console.error("Failed to start call:", err);
      setStatus("idle");
      setLimitError("Failed to start voice session. Please try again.");
    }
  }, [book._id, book.title, book.author, voice, userId, messages, messagesRef]);

  const toggleMute = useCallback(() => {
    try {
      const v = getVapi();
      const nextMuted = !isMuted;
      v.setMuted(nextMuted);
      setIsMuted(nextMuted);
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  }, [isMuted]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    setStatus("idle");
    setIsMuted(false);
    try {
      getVapi().stop().catch(() => {});
    } catch {
      // Ignore
    }
  }, []);

  const clearError = useCallback(() => {
    setLimitError(null);
    setIsBillingError(false);
  }, []);

  const isActive =
    status === "starting" ||
    status === "listening" ||
    status === "thinking" ||
    status === "speaking";

  return {
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
    limitError,
    isBillingError,
    maxDurationSeconds,
    clearError,
  };
}

export default useVapi;
