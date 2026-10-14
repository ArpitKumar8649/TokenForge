import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { 
  Search, 
  Send, 
  User, 
  MessageCircle, 
  ShieldCheck, 
  Plus, 
  X, 
  Mail, 
  ChevronLeft, 
  ChevronDown,
  Check, 
  CheckCheck,
  AlertCircle,
  Loader2,
  Trash2
} from "lucide-react";
import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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

export default function AdminSupport() {
  const utils = trpc.useUtils();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Proactive Conversation Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [findUserError, setFindUserError] = useState<string | null>(null);
  const [proactiveUser, setProactiveUser] = useState<{ id: number; name: string | null; email: string | null } | null>(null);

  const { data: conversations = [], isLoading: isLoadingConversations } = trpc.support.adminGetConversations.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const { data: activeChatHistory = [], isLoading: isLoadingChat } = trpc.support.adminGetChatHistory.useQuery(
    { userId: selectedUserId! },
    { 
      enabled: selectedUserId !== null,
      refetchInterval: selectedUserId !== null ? 2000 : false,
    }
  );

  const markAsRead = trpc.support.adminMarkAsRead.useMutation({
    onSuccess: () => {
      utils.support.adminGetConversations.invalidate();
    },
  });

  const sendReply = trpc.support.adminSendReply.useMutation({
    onSuccess: () => {
      setReplyContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      utils.support.adminGetChatHistory.invalidate();
      utils.support.adminGetConversations.invalidate();
      utils.support.getUnreadCount.invalidate();
    },
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const deleteMessage = trpc.support.adminDeleteMessage.useMutation({
    onMutate: async ({ messageId }) => {
      // Optimistically remove from activeChatHistory immediately so it disappears with 0ms delay!
      if (selectedUserId !== null) {
        await utils.support.adminGetChatHistory.cancel({ userId: selectedUserId });
        const prev = utils.support.adminGetChatHistory.getData({ userId: selectedUserId });
        if (prev) {
          utils.support.adminGetChatHistory.setData(
            { userId: selectedUserId },
            prev.filter((m) => m.id !== messageId)
          );
        }
        return { prev };
      }
    },
    onError: (err, _newVal, context) => {
      if (context?.prev && selectedUserId !== null) {
        utils.support.adminGetChatHistory.setData({ userId: selectedUserId }, context.prev);
      }
      toast.error(err?.message || "Failed to delete message");
    },
    onSuccess: () => {
      toast.success("Message deleted");
    },
    onSettled: () => {
      setConfirmDeleteId(null);
      if (selectedUserId !== null) {
        utils.support.adminGetChatHistory.invalidate({ userId: selectedUserId });
      }
      utils.support.adminGetConversations.invalidate();
      utils.support.getHistory.invalidate();
      utils.support.getUnreadCount.invalidate();
    },
  });

  const findUser = trpc.support.adminFindUserByEmail.useMutation();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevChatLengthRef = useRef(0);
  const prevUserIdRef = useRef<number | null>(null);
  const justSentRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadSinceScrollUp, setUnreadSinceScrollUp] = useState(0);

  useEffect(() => {
    if (selectedUserId) {
      markAsRead.mutate({ userId: selectedUserId });
    }
  }, [selectedUserId, activeChatHistory.length]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom <= 80;
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
    const isUserChange = prevUserIdRef.current !== selectedUserId;
    prevUserIdRef.current = selectedUserId;

    const currentLength = activeChatHistory.length;
    const prevLength = prevChatLengthRef.current;
    const hasNewMessages = currentLength > prevLength;
    prevChatLengthRef.current = currentLength;

    if (isUserChange) {
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

    // If periodic polling returned the exact same message count, NEVER hijack user scroll
    if (!hasNewMessages) {
      return;
    }

    // If admin just sent a message, scroll immediately to show it
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

    // If a new message arrived from the user:
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      // User is scrolled up reviewing history: preserve scroll and show badge
      setUnreadSinceScrollUp((prev) => prev + (currentLength - prevLength));
    }
  }, [activeChatHistory, selectedUserId]);

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setFindUserError("Please enter an email address.");
      return;
    }

    setFindUserError(null);
    try {
      const user = await findUser.mutateAsync({ email: cleanEmail });
      setProactiveUser(user);
      setSelectedUserId(user.id);
      setIsNewChatModalOpen(false);
      setEmailInput("");
      setFindUserError(null);
      utils.support.adminGetConversations.invalidate();
    } catch (err: any) {
      setFindUserError(err?.message || `No user found with email "${cleanEmail}".`);
    }
  };

  // Combine database conversations with any newly initiated proactive user
  const allConversations = [...conversations];
  if (proactiveUser && !allConversations.some(c => c.user.id === proactiveUser.id)) {
    allConversations.unshift({
      user: proactiveUser,
      unreadCount: 0,
      latestMessageAt: new Date(),
      latestMessagePreview: "Initiated chat — send your first message",
    });
  }

  const filteredConversations = allConversations.filter(conv => {
    const term = searchQuery.toLowerCase();
    const nameMatch = conv.user.name?.toLowerCase().includes(term);
    const emailMatch = conv.user.email?.toLowerCase().includes(term);
    return !searchQuery || nameMatch || emailMatch;
  });

  const selectedConversation = allConversations.find(c => c.user.id === selectedUserId);

  return (
    <div className="relative flex h-[calc(100dvh-13rem)] sm:h-[calc(100vh-11rem)] min-h-[480px] sm:min-h-[540px] max-h-[760px] w-full max-w-full overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl min-w-0">
      {/* LEFT SIDEBAR - WHATSAPP STYLE CONTACT LIST */}
      <div 
        className={`flex w-full md:w-[320px] lg:w-[360px] shrink-0 min-w-0 flex-col border-r border-white/10 bg-[#0d0d10] transition-all ${
          selectedUserId !== null ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-white/10 px-3 sm:px-4 bg-black/40 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c8ff74]/15 text-[#c8ff74] shrink-0">
              <MessageCircle size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">Live Support Chats</h2>
              <p className="text-[9px] sm:text-[10px] text-gray-500 truncate">Realtime customer assistance</p>
            </div>
          </div>
          <span className="rounded-full bg-white/5 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-gray-400 shrink-0">
            {allConversations.length} {allConversations.length === 1 ? "chat" : "chats"}
          </span>
        </div>
        
        {/* Search Bar + New Chat Button */}
        <div className="flex items-center gap-2 p-2.5 sm:p-3 border-b border-white/5 bg-[#0a0a0d] min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..." 
              className="w-full rounded-full border border-white/10 bg-black/60 py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:border-[#c8ff74] focus:outline-none focus:ring-1 focus:ring-[#c8ff74]"
            />
          </div>
          <button
            onClick={() => {
              setIsNewChatModalOpen(true);
              setFindUserError(null);
              setEmailInput("");
            }}
            title="Start conversation with user by email"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c8ff74] text-[#12210c] hover:bg-[#bbf366] transition-all duration-150 active:scale-95 shadow-sm font-semibold"
          >
            <Plus size={16} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {isLoadingConversations && allConversations.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs text-gray-500">
              <Loader2 size={16} className="animate-spin mr-2 text-[#c8ff74]" /> Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center text-gray-500 px-6 text-center">
              <MessageCircle size={28} className="mb-2 opacity-30 text-[#c8ff74]" />
              <p className="text-xs font-medium text-gray-300">No conversations found</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {searchQuery ? "Try another search term or start a new chat" : "Click '+' above to initiate a chat with any user"}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedUserId === conv.user.id;
              return (
                <button
                  key={conv.user.id}
                  onClick={() => setSelectedUserId(conv.user.id)}
                  className={`flex w-full items-start gap-2.5 sm:gap-3 border-b border-white/5 p-3 sm:p-3.5 text-left transition-colors hover:bg-white/5 min-w-0 ${
                    isSelected ? "bg-white/10 border-l-2 border-l-[#c8ff74]" : ""
                  }`}
                >
                  <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-gray-300 font-medium text-xs border border-white/10">
                    {conv.user.name ? conv.user.name.charAt(0).toUpperCase() : <User size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-medium text-white">{conv.user.name || "TokenForge User"}</span>
                      <span className="shrink-0 text-[10px] text-gray-500">
                        {conv.latestMessageAt ? getDateSeparator(conv.latestMessageAt) : ""}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 truncate mt-0.5">{conv.user.email}</div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] text-gray-400 leading-tight">
                        {conv.latestMessagePreview || "Start conversation"}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="ml-1 flex h-4 min-w-[16px] px-1 shrink-0 items-center justify-center rounded-full bg-[#c8ff74] text-[9px] font-bold text-[#12210c] shadow-sm">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT MAIN PANEL - ACTIVE WHATSAPP-STYLE CHAT */}
      <div 
        className={`flex flex-1 min-w-0 flex-col bg-[#0b0c10] relative transition-all ${
          selectedUserId === null ? "hidden md:flex" : "flex"
        }`}
      >
        {!selectedUserId ? (
          <div className="flex flex-1 flex-col items-center justify-center text-gray-500 p-6 sm:p-8 text-center min-w-0">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/5 text-gray-400 mb-4 border border-white/10">
              <MessageCircle size={30} className="text-[#c8ff74]" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-white">TokenForge Live Support Center</h3>
            <p className="text-xs text-gray-400 mt-1.5 max-w-sm leading-relaxed px-4">
              Select a user conversation from the left, or click the <span className="text-[#c8ff74] font-semibold">+</span> button to initiate a new direct chat with any registered user by their email address.
            </p>
          </div>
        ) : (
          <>
            {/* Active Header (with Responsive Mobile Back Button) */}
            <div className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d0d10] px-3 sm:px-5 min-w-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="flex md:hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                  title="Back to conversations"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#c8ff74] text-[#12210c] font-bold text-xs shrink-0">
                  {selectedConversation?.user.name ? selectedConversation.user.name.charAt(0).toUpperCase() : <User size={15} />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">
                    {selectedConversation?.user.name || "TokenForge User"}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gray-400 truncate">
                    {selectedConversation?.user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] text-gray-300 shrink-0">
                <ShieldCheck size={12} className="text-[#c8ff74]" />
                <span className="hidden xs:inline sm:inline">ID:</span> #{selectedUserId}
              </div>
            </div>

            {/* Messages Stream with Date Dividers and Precise Timestamps */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-4 min-w-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px]"
            >
              {isLoadingChat ? (
                <div className="flex justify-center items-center text-xs text-gray-500 py-10">
                  <Loader2 size={16} className="animate-spin mr-2 text-[#c8ff74]" /> Loading messages...
                </div>
              ) : activeChatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-gray-500 py-12 text-center px-4">
                  <div className="size-10 rounded-full bg-[#c8ff74]/10 border border-[#c8ff74]/20 flex items-center justify-center text-[#c8ff74] mb-3">
                    <Send size={16} />
                  </div>
                  <p className="text-xs font-semibold text-gray-300">No messages in this chat yet</p>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                    Type a message below to reach out to {selectedConversation?.user.email || "this user"}. They will see it immediately on their dashboard with an unread badge counter!
                  </p>
                </div>
              ) : (
                activeChatHistory.map((msg, index) => {
                  const isAdmin = msg.senderRole === "admin";
                  const prevMsg = index > 0 ? activeChatHistory[index - 1] : null;
                  const showDateHeader =
                    !prevMsg ||
                    new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                  return (
                    <div key={msg.id} className="space-y-2.5 sm:space-y-3 min-w-0">
                      {showDateHeader && (
                        <div className="flex justify-center my-2 sm:my-3">
                          <span className="rounded-full border border-white/10 bg-[#16161d] px-2.5 sm:px-3 py-0.5 text-[9px] sm:text-[10px] font-medium text-gray-400 shadow-sm">
                            {getDateSeparator(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      <div className={`flex items-start gap-1.5 sm:gap-2 ${isAdmin ? "justify-end" : "justify-start"} group relative min-w-0`}>
                        {/* Admin delete action button (only for admin's own sent messages) */}
                        {isAdmin && (
                          <div className="flex items-center self-center shrink-0">
                            {confirmDeleteId === msg.id ? (
                              <div className="flex items-center gap-1 rounded-lg bg-[#181920] border border-red-500/40 px-1.5 py-0.5 sm:px-2 sm:py-1 shadow-lg text-[10px] sm:text-[11px] animate-in fade-in">
                                <span className="text-red-400 font-medium whitespace-nowrap">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => deleteMessage.mutate({ messageId: msg.id })}
                                  disabled={deleteMessage.isPending}
                                  className="px-1.5 py-0.5 rounded bg-red-500 hover:bg-red-600 text-white font-semibold text-[9px] sm:text-[10px] transition-colors disabled:opacity-50"
                                >
                                  {deleteMessage.isPending ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 text-[9px] sm:text-[10px] transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(msg.id)}
                                title="Delete this message for everyone"
                                className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 sm:p-1.5 rounded-full text-gray-400 hover:text-red-400 hover:bg-white/5 transition-all active:scale-95"
                              >
                                <Trash2 size={12} className="sm:size-[13px]" />
                              </button>
                            )}
                          </div>
                        )}

                        {!isAdmin && (
                          <div 
                            title={`${selectedConversation?.user.name || "User"} (${selectedConversation?.user.email})`}
                            className="size-6 sm:size-7 shrink-0 mt-0.5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 text-[10px] sm:text-xs"
                          >
                            {selectedConversation?.user.name ? selectedConversation.user.name.charAt(0).toUpperCase() : <User size={13} />}
                          </div>
                        )}

                        <div
                          title={formatFullTimestamp(msg.createdAt)}
                          className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs shadow-sm leading-relaxed transition-all min-w-0 break-words [overflow-wrap:anywhere] ${
                            isAdmin
                              ? "bg-[#c8ff74] text-[#12210c] font-medium rounded-br-xs"
                              : "bg-[#1f2027] text-white border border-white/10 rounded-bl-xs"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</div>
                          
                          <div
                            className={`flex items-center justify-end gap-1 text-[9px] mt-1 font-normal ${
                              isAdmin ? "text-[#12210c]/70" : "text-gray-400"
                            }`}
                          >
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            {isAdmin && (
                              <span title={msg.isRead ? "Read by user" : "Delivered"}>
                                {msg.isRead ? (
                                  <CheckCheck size={12} className="text-[#12210c]" />
                                ) : (
                                  <Check size={12} className="text-[#12210c]/60" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {isAdmin && (
                          <div 
                            title="Admin Reply"
                            className="size-6 sm:size-7 shrink-0 mt-0.5 rounded-full bg-[#c8ff74]/15 border border-[#c8ff74]/30 flex items-center justify-center overflow-hidden shadow-sm"
                          >
                            <TokenForgeGlyph className="size-3.5 sm:size-4 text-[#c8ff74]" label="Admin Avatar" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Floating "Scroll to Bottom" button when user is scrolled up */}
            <AnimatePresence>
              {showScrollToBottom && (
                <motion.button
                  initial={{ opacity: 0, y: 8, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.92 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-20 right-4 sm:right-6 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-[#171822]/95 px-3 py-1.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md hover:bg-[#20222f] hover:border-[#c8ff74]/40 transition-all active:scale-95"
                >
                  <ChevronDown size={14} className="text-[#c8ff74]" />
                  <span>Latest messages</span>
                  {unreadSinceScrollUp > 0 && (
                    <span className="ml-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#c8ff74] text-[9px] font-extrabold text-[#12210c]">
                      {unreadSinceScrollUp}
                    </span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Reply Input Bar (Enter = New Line, Send Button = Submit) */}
            <div className="border-t border-white/10 bg-[#0d0d10] p-2.5 sm:p-4 min-w-0">
              <div className="max-w-4xl mx-auto flex flex-col gap-1.5 min-w-0">
                <div className="flex items-end gap-2 w-full min-w-0">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={replyContent}
                    onChange={(e) => {
                      setReplyContent(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 130)}px`;
                    }}
                    onKeyDown={(e) => {
                      // Natural newline on Enter - no form auto-submission
                      if (e.key === "Enter" && !e.shiftKey) {
                        // Allow natural newline insertion in textarea
                      }
                    }}
                    placeholder={`Type message to ${selectedConversation?.user.name || "user"}...`}
                    disabled={sendReply.isPending}
                    className="flex-1 min-w-0 resize-none rounded-2xl border border-white/10 bg-black/60 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs text-white placeholder-gray-500 focus:border-[#c8ff74] focus:outline-none focus:ring-1 focus:ring-[#c8ff74] max-h-[120px] sm:max-h-[130px] leading-relaxed transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (replyContent.trim() && !sendReply.isPending && selectedUserId) {
                        justSentRef.current = true;
                        sendReply.mutate({ userId: selectedUserId, content: replyContent.trim() });
                      }
                    }}
                    disabled={!replyContent.trim() || sendReply.isPending}
                    className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#c8ff74] text-[#12210c] disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-sm mb-0.5"
                    title="Send message"
                  >
                    {sendReply.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} className="-ml-[1px] mt-[1px]" />
                    )}
                  </button>
                </div>
                <div className="hidden sm:flex items-center justify-between px-2 text-[10px] text-gray-500 select-none">
                  <span>Press <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">Enter</kbd> to add a new line</span>
                  <span className="text-gray-400">Click <b>Send</b> button to deliver</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* NEW CONVERSATION MODAL */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#121318] p-6 shadow-2xl text-left"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setIsNewChatModalOpen(false);
                  setFindUserError(null);
                }}
                className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c8ff74]/15 text-[#c8ff74] border border-[#c8ff74]/30">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Start New Conversation</h3>
                  <p className="text-xs text-gray-400">Initiate a direct chat session with any user</p>
                </div>
              </div>

              <form onSubmit={handleStartConversation} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    User Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (findUserError) setFindUserError(null);
                      }}
                      placeholder="e.g. developer@example.com"
                      className="w-full rounded-xl border border-white/10 bg-black/60 py-2.5 pl-10 pr-3 text-xs text-white placeholder-gray-500 focus:border-[#c8ff74] focus:outline-none focus:ring-1 focus:ring-[#c8ff74]"
                    />
                  </div>
                </div>

                {findUserError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
                    <span>{findUserError}</span>
                  </motion.div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewChatModalOpen(false);
                      setFindUserError(null);
                    }}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={findUser.isPending || !emailInput.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-[#c8ff74] px-4 py-2 text-xs font-bold text-[#12210c] hover:bg-[#bbf366] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                  >
                    {findUser.isPending ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Checking database...
                      </>
                    ) : (
                      <>
                        <Plus size={14} className="stroke-[2.5]" />
                        Start Conversation
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

