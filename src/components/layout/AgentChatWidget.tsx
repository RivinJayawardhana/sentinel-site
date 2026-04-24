import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CHAT_ENDPOINT = "http://127.0.0.1:8000/chat";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    content,
    createdAt: Date.now(),
  };
}

function extractAssistantReply(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload.trim() || null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as Record<string, unknown>;
  const directKeys = ["answer", "reply", "response", "content", "text"];

  for (const key of directKeys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const messageValue = body.message;
  if (typeof messageValue === "string" && messageValue.trim()) {
    return messageValue.trim();
  }
  if (messageValue && typeof messageValue === "object") {
    const messageObject = messageValue as Record<string, unknown>;
    if (typeof messageObject.content === "string" && messageObject.content.trim()) {
      return messageObject.content.trim();
    }
  }

  const choices = body.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    if (first && typeof first === "object") {
      const choice = first as Record<string, unknown>;
      if (typeof choice.text === "string" && choice.text.trim()) {
        return choice.text.trim();
      }
      const message = choice.message;
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
      if (message && typeof message === "object") {
        const nested = message as Record<string, unknown>;
        if (typeof nested.content === "string" && nested.content.trim()) {
          return nested.content.trim();
        }
      }
    }
  }

  return null;
}

export function AgentChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isOpen, isSending]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage = createMessage("user", trimmed);
    const nextHistory = [
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: trimmed },
    ];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: trimmed,
          messages: nextHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}.`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      const payload: unknown = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      const reply = extractAssistantReply(payload);
      if (!reply) {
        throw new Error("No assistant reply found in response.");
      }

      setMessages((prev) => [...prev, createMessage("assistant", reply)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send chat message.";
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
      {isOpen && (
        <section className="h-[min(50vh,42rem)] w-[min(50vw,42rem)] min-h-[24rem] min-w-[22rem] max-h-[calc(100vh-7rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Agent Chat</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>

            <ScrollArea className="flex-1 px-3 py-3">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    Ask the assistant anything related to the dashboard.
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm",
                      message.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto border bg-muted text-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                ))}

                {isSending && (
                  <div className="mr-auto flex max-w-[85%] items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Agent is typing...</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <form className="border-t p-3" onSubmit={handleSubmit}>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="min-h-[72px] resize-none"
                disabled={isSending}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Enter to send, Shift+Enter for new line</p>
                <Button type="submit" size="sm" disabled={isSending || !input.trim()}>
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  Send
                </Button>
              </div>
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            </form>
          </div>
        </section>
      )}

      <Button
        type="button"
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Hide chat" : "Open chat"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}
