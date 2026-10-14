import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, LogIn, Check, CheckCheck, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { TokenForgeGlyph } from "./TokenForgeGlyph";

function formatMessageTime(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFullTimestamp(date: Date | string) {
  const d = new Date(date);
  return `${d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

function getDateSeparator(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  
  if (d.toDateString() === now.toDateString()) {
    return "Today";
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function SupportChatWidget() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  
  const utils = trpc.useUtils();
  const { data: unreadCount = 0 } = trpc.support.getUnreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: isOpen ? 15_000 : 120_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  
  const { data: history = [] } = trpc.support.getHistory.useQuery(undefined, {
    enabled: !!user && isOpen,
    refetchInterval: isOpen ? 10_000 : false,
    refetchIntervalInBackground: false,
  });

  const markAsRead = trpc.support.markAsRead.useMutation({
    onSuccess: () => {
      utils.support.getUnreadCount.invalidate();
    }
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevHistoryLengthRef = useRef(0);
  const justSentRef = useRef(false);
  const wasOpenRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadSinceScrollUp, setUnreadSinceScrollUp] = useState(0);

  const sendMessage = trpc.support.sendMessage.useMutation({
    onSuccess: () => {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      utils.support.getHistory.invalidate();
      utils.support.getUnreadCount.invalidate();
    }
  });

  useEffect(() => {
    if (isOpen && user) {
      markAsRead.mutate();
    }
  }, [isOpen, user]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom <= 60;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowScrollToBottom(false);
      setUnreadSinceScrollUp(0);
    } else {
      setShowScrollToBottom(true);
    }
  };

  const scrollToBottom = () => {
    isAtBottomRef.current = true;
    setShowScrollToBottom(false);
    setUnreadSinceScrollUp(0);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const isInitialOpen = !wasOpenRef.current;
    wasOpenRef.current = true;

    const currentLength = history.length;
    const prevLength = prevHistoryLengthRef.current;
    const hasNewMessages = currentLength > prevLength;
    prevHistoryLengthRef.current = currentLength;

    if (isInitialOpen) {
      isAtBottomRef.current = true;
      setShowScrollToBottom(false);
      setUnreadSinceScrollUp(0);
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 50);
      return;
    }

    // Polling tick with no new messages: do not touch scroll
    if (!hasNewMessages) {
      return;
    }

    // User just sent a message: scroll to bottom
    if (justSentRef.current) {
      justSentRef.current = false;
      isAtBottomRef.current = true;
      setShowScrollToBottom(false);
      setUnreadSinceScrollUp(0);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return;
    }

    // New response arrived from admin:
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      // User is scrolled up reading earlier messages; keep scroll and count unread
      setUnreadSinceScrollUp((prev) => prev + (currentLength - prevLength));
    }
  }, [history, isOpen]);

  // Hide the floating widget on the admin panel
  if (location.startsWith("/admin") || location.startsWith("/dashboard/admin")) {
    return null;
  }

  return (
    <div id="tokenforge-support-widget" className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-[9999] flex flex-col items-end pointer-events-auto max-w-[calc(100vw-1.5rem)]">
      {/* Cloud Notification tooltip */}
      <AnimatePresence>
        {!isOpen && unreadCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.85 }}
            onClick={() => setIsOpen(true)}
            className="mb-3 mr-1 cursor-pointer select-none rounded-2xl rounded-br-sm border border-[#c8ff74]/40 bg-[#162210]/95 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-semibold text-[#c8ff74] shadow-2xl backdrop-blur-md transition-all hover:scale-105 flex items-center gap-2 max-w-[calc(100vw-2rem)]"
          >
            <span>☁️</span>
            <span className="truncate">You have a message from admin!</span>
            <span className="flex h-5 min-w-[20px] px-1.5 shrink-0 items-center justify-center rounded-full bg-[#c8ff74] text-[10px] font-black text-[#12210c] shadow-sm">
              {unreadCount}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window Box */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-3 flex h-[480px] max-h-[calc(100dvh-5.5rem)] w-[calc(100vw-1.5rem)] xs:w-[350px] sm:w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d10] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative min-w-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-3.5 sm:px-4 py-2.5 sm:py-3 min-w-0">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-[#c8ff74]/30 overflow-hidden shadow-sm">
                  <TokenForgeGlyph className="size-4 text-primary" label="TokenForge Support" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">TokenForge Support</div>
                  <div className="text-[9px] sm:text-[10px] text-[#c8ff74] flex items-center gap-1 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c8ff74] inline-block animate-pulse shrink-0" />
                    Online • Typically replies in 1-2h
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors shrink-0 active:scale-95"
                title="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            {!user ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center min-w-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-400 mb-3 border border-white/10">
                  <LogIn size={24} />
                </div>
                <h4 className="text-sm font-semibold text-white">Sign in to contact support</h4>
                <p className="mt-1 text-xs text-gray-400 max-w-xs">
                  Log in to your TokenForge account to start a live support conversation with our team.
                </p>
                <Link
                  href="/signin"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#c8ff74] px-4 py-2 text-xs font-bold text-[#12210c] shadow hover:bg-[#bbf062] transition-colors active:scale-95"
                >
                  <LogIn size={14} />
                  Sign In
                </Link>
              </div>
            ) : (
              <>
                <div 
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] min-w-0"
                >
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4 min-w-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-[#c8ff74]/20 mb-2 overflow-hidden">
                        <TokenForgeGlyph className="size-6 text-primary" label="Support Assistant" />
                      </div>
                      <p className="text-xs font-medium text-white">How can we help you today?</p>
                      <p className="text-[11px] text-gray-400 mt-1 max-w-[220px]">
                        Send us a message detailing your inquiry, and our admin team will reply promptly.
                      </p>
                    </div>
                  ) : (
                    history.map((msg, index) => {
                      const isUser = msg.senderRole === "user";
                      const prevMsg = index > 0 ? history[index - 1] : null;
                      const showDateHeader =
                        !prevMsg ||
                        new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                      return (
                        <div key={msg.id} className="space-y-2 min-w-0">
                          {showDateHeader && (
                            <div className="flex justify-center my-2">
                              <span className="rounded-full border border-white/10 bg-[#17181e] px-2.5 py-0.5 text-[9px] font-medium text-gray-400 shadow-sm">
                                {getDateSeparator(msg.createdAt)}
                              </span>
                            </div>
                          )}

                          {isUser ? (
                            <div className="flex justify-end min-w-0">
                              <div 
                                title={formatFullTimestamp(msg.createdAt)}
                                className="max-w-[85%] rounded-2xl px-3 sm:px-3.5 py-2 text-xs leading-relaxed bg-[#c8ff74] text-[#12210c] font-medium rounded-br-xs shadow-sm min-w-0 break-words [overflow-wrap:anywhere]"
                              >
                                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</div>
                                <div className="flex items-center justify-end gap-1 text-[9px] mt-1 text-[#12210c]/75 font-normal">
                                  <span>{formatMessageTime(msg.createdAt)}</span>
                                  <span title={msg.isRead ? "Read by support team" : "Delivered"}>
                                    {msg.isRead ? (
                                      <CheckCheck size={12} className="text-[#12210c]" />
                                    ) : (
                                      <Check size={12} className="text-[#12210c]/60" />
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 justify-start min-w-0">
                              {/* Floating AI / Support Avatar matching Playground */}
                              <div className="size-6 sm:size-7 shrink-0 mt-0.5 rounded-full bg-primary/10 border border-[#c8ff74]/25 flex items-center justify-center overflow-hidden shadow-sm">
                                <TokenForgeGlyph className="size-3.5 sm:size-4 text-primary" label="TokenForge response" />
                              </div>
                              <div 
                                title={formatFullTimestamp(msg.createdAt)}
                                className="max-w-[80%] rounded-2xl px-3 sm:px-3.5 py-2 text-xs leading-relaxed bg-[#1d1e24] text-white border border-white/10 rounded-bl-xs shadow-sm min-w-0 break-words [overflow-wrap:anywhere]"
                              >
                                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</div>
                                <div className="text-[9px] mt-1 text-right text-gray-400 font-normal">
                                  {formatMessageTime(msg.createdAt)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Floating "Scroll to Bottom" button when scrolled up */}
                <AnimatePresence>
                  {showScrollToBottom && (
                    <motion.button
                      initial={{ opacity: 0, y: 6, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.9 }}
                      onClick={scrollToBottom}
                      className="absolute bottom-16 right-4 z-20 flex items-center gap-1 rounded-full border border-white/15 bg-[#171822]/95 px-2.5 py-1 text-[11px] font-medium text-white shadow-2xl backdrop-blur-md hover:bg-[#20222f] hover:border-[#c8ff74]/40 transition-all active:scale-95"
                    >
                      <ChevronDown size={13} className="text-[#c8ff74]" />
                      <span>Latest messages</span>
                      {unreadSinceScrollUp > 0 && (
                        <span className="ml-0.5 flex h-3.5 min-w-[14px] px-1 items-center justify-center rounded-full bg-[#c8ff74] text-[8px] font-extrabold text-[#12210c]">
                          {unreadSinceScrollUp}
                        </span>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Input Bar (Enter adds new line, send button submits) */}
                <div className="border-t border-white/10 bg-[#141418] p-2 sm:p-2.5 min-w-0">
                  <div className="flex items-end gap-1.5 sm:gap-2 min-w-0">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
                      }}
                      onKeyDown={(e) => {
                        // Natural newline on Enter - no auto-submit
                        if (e.key === "Enter" && !e.shiftKey) {
                          // Allow natural newline insertion
                        }
                      }}
                      placeholder="Type your message..."
                      disabled={sendMessage.isPending}
                      className="flex-1 min-w-0 resize-none rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-[#c8ff74] focus:outline-none focus:ring-1 focus:ring-[#c8ff74] max-h-[110px] leading-relaxed transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (input.trim() && !sendMessage.isPending) {
                          justSentRef.current = true;
                          sendMessage.mutate({ content: input.trim() });
                        }
                      }}
                      disabled={!input.trim() || sendMessage.isPending}
                      title="Send message"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c8ff74] text-[#12210c] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 mb-0.5 shadow-sm"
                    >
                      {sendMessage.isPending ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} className="-ml-[1px] mt-[1px]" />
                      )}
                    </button>
                  </div>
                  <div className="hidden xs:flex items-center justify-between px-1.5 pt-1 text-[9px] text-gray-500 select-none">
                    <span>Press <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">Enter</kbd> to add a new line</span>
                    <span>Click send button</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Circle Button */}
      <button
        id="tokenforge-chat-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open support chat"
        className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${
          isOpen
            ? "bg-[#25252b] text-white ring-2 ring-white/20"
            : "bg-[#c8ff74] text-[#12210c] shadow-[0_4px_25px_rgba(200,255,116,0.4)] hover:shadow-[0_6px_30px_rgba(200,255,116,0.6)]"
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isOpen ? "close" : "open"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {isOpen ? <X size={24} /> : <MessageCircle size={26} className="fill-current" />}
          </motion.div>
        </AnimatePresence>

        {!isOpen && unreadCount > 0 && (
          <motion.div
            key="unread-badge"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 0.35 }}
            className="absolute -right-1 -top-1 flex h-6 min-w-[24px] px-1.5 items-center justify-center rounded-full bg-red-500 text-[11px] font-extrabold text-white shadow-lg ring-2 ring-[#09090b] animate-pulse"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.div>
        )}
      </button>
    </div>
  );
}
