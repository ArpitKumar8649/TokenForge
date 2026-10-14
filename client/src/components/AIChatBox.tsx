import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Send, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { TokenForgeGlyph } from "./TokenForgeGlyph";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
  thinking?: string;
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    const updateMinHeight = () => {
      if (containerRef.current && inputAreaRef.current) {
        const containerHeight = containerRef.current.offsetHeight;
        const inputHeight = inputAreaRef.current.offsetHeight;
        const scrollAreaHeight = containerHeight - inputHeight;

        // Reserve space for:
        // - padding (p-3 sm:p-4)
        // - user message: ~48px
        const userMessageReservedHeight = 52;
        const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;

        setMinHeightForLastMessage(Math.max(0, calculatedHeight));
      }
    };

    updateMinHeight();
    window.addEventListener("resize", updateMinHeight);
    return () => window.removeEventListener("resize", updateMinHeight);
  }, []);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput("");

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm w-full min-w-0 max-w-full overflow-hidden",
        className
      )}
      style={height ? { height } : undefined}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-3 sm:p-4 overflow-y-auto">
            <div className="flex flex-1 flex-col items-center justify-center gap-5 sm:gap-6 text-muted-foreground my-auto py-6">
              <div className="flex flex-col items-center gap-2.5 text-center px-4">
                <TokenForgeGlyph className="size-10 sm:size-12 opacity-30" label="TokenForge" />
                <p className="text-xs sm:text-sm max-w-md">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl w-full flex-wrap justify-center gap-2 px-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 break-words max-w-full"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full w-full min-w-0">
            <div className="flex flex-col space-y-3.5 sm:space-y-4 p-3 sm:p-4 min-w-0 w-full">
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const isPendingAssistant = message.role === "assistant" && isLoading && isLastMessage && !message.content && !message.thinking;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-2 sm:gap-3 w-full min-w-0 max-w-full",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-7 sm:size-8 shrink-0 mt-0.5 rounded-full bg-primary/10 flex items-center justify-center">
                        <TokenForgeGlyph className="size-3.5 sm:size-4 text-primary" label="TokenForge response" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[88%] sm:max-w-[82%] min-w-0 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 break-words [overflow-wrap:anywhere]",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {isPendingAssistant ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="TokenForge is responding" />
                      ) : message.role === "assistant" ? (
                        <div className="min-w-0 w-full overflow-hidden">
                          {message.thinking ? (
                            <details className="mb-3 rounded-md border border-lime-400/20 bg-lime-400/[0.045] px-2.5 sm:px-3 py-2 text-xs text-muted-foreground min-w-0 max-w-full overflow-hidden">
                              <summary className="cursor-pointer select-none font-medium text-lime-200 marker:text-lime-300">Thinking summary</summary>
                              <div className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] border-t border-lime-400/15 pt-2 italic leading-5 text-lime-50/70 max-w-full overflow-x-auto text-[11px] sm:text-xs">{message.thinking}</div>
                            </details>
                          ) : null}
                          {message.content ? (
                            <div className="prose prose-sm dark:prose-invert max-w-full min-w-0 leading-6 break-words [overflow-wrap:anywhere] prose-p:my-2 prose-p:text-[13px] sm:prose-p:text-[14px] prose-p:leading-6 prose-headings:my-2.5 prose-headings:font-bold prose-h1:text-[18px] sm:prose-h1:text-[21px] prose-h2:text-[16px] sm:prose-h2:text-[19px] prose-h3:text-[15px] sm:prose-h3:text-[17px] prose-li:my-1 prose-li:text-[13px] sm:prose-li:text-[14px] prose-pre:max-w-full prose-pre:overflow-x-auto">
                              <Streamdown>{message.content}</Streamdown>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-xs sm:text-sm break-words [overflow-wrap:anywhere] min-w-0">
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-7 sm:size-8 shrink-0 mt-0.5 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-3.5 sm:size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && displayMessages[displayMessages.length - 1]?.role !== "assistant" && (
                <div
                  className="flex items-start gap-2 sm:gap-3 w-full min-w-0"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="size-7 sm:size-8 shrink-0 mt-0.5 rounded-full bg-primary/10 flex items-center justify-center">
                    <TokenForgeGlyph className="size-3.5 sm:size-4 text-primary" label="TokenForge is responding" />
                  </div>
                  <div className="rounded-xl bg-muted px-3 sm:px-4 py-2 sm:py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex gap-2 p-2.5 sm:p-4 border-t bg-background/50 items-end min-w-0 max-w-full"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 max-h-32 resize-none min-h-9 text-xs sm:text-sm min-w-0"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
