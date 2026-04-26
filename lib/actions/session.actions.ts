"use server";

import VoiceSession from "@/database/models/voice-session.model";
import { connectToDatabase } from "@/database/mongoose";
import { EndSessionResult, StartSessionResult } from "@/types";
import { getCurrentBillingPeriodStart } from "../subscription-constants";

export const startVoiceSession = async (
  clerkId: string,
  bookId: string,
): Promise<StartSessionResult> => {
  try {
    await connectToDatabase();

    //limits/plain to see whether a session is allowed to start based on the user's usage and subscription status

    const session = await VoiceSession.create({
      clerkId,
      bookId,
      startedAt: new Date(),
      billingPeriodStart: getCurrentBillingPeriodStart(),
      durationSecounds: 0,
    });

    return {
      success: true,
      sessionId: session._id.toString(),
      // maxDurationMinutes: check.maxDurationMinutes,
    };
  } catch (error) {
    console.error("Error starting voice session:", error);
    return { success: false, error: "Failed to start voice session." };
  }
};

export const endVoiceSession = async (
  sessionId: string,
  durationSeconds: number,
): Promise<EndSessionResult> => {
  try {
    await connectToDatabase();

    const result = await VoiceSession.findByIdAndUpdate(sessionId, {
      endedAt: new Date(),
      durationSeconds,
    });
    if (!result) {
      return { success: false, error: "Voice Session not found." };
    }

    return { success: true };
  } catch (error) {
    console.error("Error ending voice session:", error);
    return { success: false, error: "Failed to end voice session." };
  }
};
