export interface NodeFieldDescription {
  [key: string]: string;
}

export interface NodeDescription {
  title: string;
  tooltip: string;
  examples?: string[];
  useCases?: string[];
  fields?: NodeFieldDescription;
}

export interface NodeDescriptions {
  [key: string]: NodeDescription;
}

export const nodeDescriptions: NodeDescriptions = {
  scripted: {
    title: "Scripted Message",
    tooltip: "Delivers exact word-for-word scripted messages. Use for greetings, confirmations, or any message that must be consistent.",
    examples: ["Welcome greeting", "Order confirmation", "Closing message"],
    fields: {
      script: "The exact text the AI agent will speak to the caller"
    }
  },

  dialogue: {
    title: "AI Dialogue",
    tooltip: "Free-form AI conversation. The agent interacts naturally with callers using the instructions you provide.",
    examples: ["Customer support conversation", "Sales pitch", "Information gathering"],
    fields: {
      stageMessage: "Instructions telling the AI what to accomplish in this conversation",
      maxTurns: "Maximum back-and-forth exchanges before moving on (optional)"
    }
  },

  field_setter: {
    title: "Field Setter",
    tooltip: "Stores data values for later use in conditions or logging. Like variables in programming.",
    examples: ["customer_type = 'VIP'", "issue_resolved = true", "call_reason = 'billing'"],
    fields: {
      fieldName: "Name of the field to store (e.g., 'customer_name', 'order_id')",
      valueType: "Type of data: text, number, or boolean",
      value: "The value to assign to this field"
    }
  },

  junction: {
    title: "Junction (If/Then)",
    tooltip: "Binary decision point. Evaluates a condition and routes to True or False path.",
    examples: [
      "Is customer VIP? → Route to priority service",
      "Is business hours? → Answer call or go to voicemail",
      "Issue resolved? → Thank customer or transfer to human"
    ],
    fields: {
      conditionField: "The field to check (e.g., 'customer_type', 'is_business_hours')",
      operator: "How to compare: ==, !=, >, <, >=, <=, is_null, is_not_null",
      compareValue: "Value to compare against"
    }
  },

  switch: {
    title: "Switch (Menu)",
    tooltip: "Multi-way branching. Routes to different paths based on a field value matching multiple cases.",
    examples: [
      "Press 1 for Sales, 2 for Support, 3 for Billing",
      "Route by customer tier: Bronze, Silver, Gold",
      "Different flows per product category"
    ],
    fields: {
      switchField: "Field name whose value determines which case to follow",
      cases: "List of possible values and their labels"
    }
  },

  function: {
    title: "Function Call",
    tooltip: "Executes API calls, webhooks, or internal functions. Enables integration with external systems.",
    examples: [
      "Look up customer in database",
      "Send webhook notification",
      "Check inventory availability",
      "Validate order status"
    ],
    fields: {
      functionName: "Name of the function to execute",
      functionType: "api_call, webhook, or internal",
      url: "API endpoint URL (for API calls)",
      method: "HTTP method: GET, POST, PUT, DELETE",
      parameters: "JSON parameters to send with the request"
    }
  },

  call_transfer: {
    title: "Call Transfer",
    tooltip: "Routes the call to a phone number or extension. Ends AI interaction and hands off to human/system.",
    examples: [
      "Transfer to sales team",
      "Route to technical support",
      "Escalate to manager",
      "Forward to on-call agent"
    ],
    fields: {
      transferTo: "Destination phone number (+1234567890) or extension (ext:123)",
      transferMessage: "What the AI says before transferring",
      transferType: "cold (immediate), warm (announce first), or blind (no announcement)",
      waitMusic: "Play hold music while transferring"
    }
  },

  time_limit: {
    title: "Time Limit",
    tooltip: "Sets maximum duration for a call stage. Prevents calls from running indefinitely.",
    examples: [
      "Limit support calls to 10 minutes",
      "Warn agent at 4 minutes, end at 5 minutes",
      "Auto-transfer if conversation exceeds time limit"
    ],
    fields: {
      maxDuration: "Maximum duration in seconds",
      warningAt: "Seconds before timeout to warn the agent",
      timeoutAction: "What happens when time expires: end, transfer, repeat, or continue"
    }
  },

  reconfigure: {
    title: "Reconfigure Agent",
    tooltip: "Changes agent settings mid-conversation. Adjust voice, speed, language, or behavior on the fly.",
    examples: [
      "Switch to Spanish language",
      "Change to slower speaking speed",
      "Use different voice for different sections",
      "Adjust tone from formal to casual"
    ],
    fields: {
      setting: "What to change: voice, speed, language, or prompt",
      newValue: "New value for the setting"
    }
  },

  fallback: {
    title: "Fallback Handler",
    tooltip: "Handles errors when AI can't understand user input. Defines retry and escalation behavior.",
    examples: [
      "Retry 3 times, then transfer to human",
      "Play clarification message and try again",
      "Escalate to supervisor after failures"
    ],
    fields: {
      fallbackMessage: "What to say when the agent doesn't understand",
      retryCount: "Number of retry attempts before escalating",
      escalateTo: "Where to escalate (phone number or department)"
    }
  },

  call_direction: {
    title: "Call Direction (Entry Point)",
    tooltip: "Marks the workflow entry point. Determines if this handles inbound or outbound calls.",
    useCases: [
      "Inbound: Customer support, sales inquiries, appointment scheduling",
      "Outbound: Sales calls, appointment reminders, surveys, follow-ups"
    ],
    fields: {
      direction: "inbound (customer calling you) or outbound (you calling customer)"
    }
  },

  agent_setup: {
    title: "Agent Setup",
    tooltip: "Defines the AI agent's personality and core instructions. Applies globally to the entire call flow.",
    examples: [
      "Professional customer service agent",
      "Friendly sales representative",
      "Technical support specialist"
    ],
    fields: {
      systemMessage: "Core instructions that define the agent's role, tone, and behavior throughout calls"
    }
  },

  voicemail: {
    title: "Voicemail",
    tooltip: "Records a message from the caller when agents are unavailable. Includes transcription and notification options.",
    examples: [
      "After-hours voicemail",
      "Department unavailable message recording",
      "Leave callback request"
    ],
    fields: {
      greetingMessage: "Message to play before recording starts",
      maxDuration: "Maximum recording length in seconds (60-120 recommended)",
      transcribe: "Convert voicemail to text automatically",
      notifyEmail: "Email address to notify when voicemail received",
      saveRecording: "Keep audio file for playback"
    }
  }
};
