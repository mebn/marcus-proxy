import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ChatOllama,
  ListAgentChats,
  ListOllamaModels,
  LoadAgentChat,
  SaveAgentChat,
} from "@/wailsjs/go/app/App";
import type { app } from "@/wailsjs/go/models";

type AgentChat = app.AgentChat;
type AgentChatSummary = app.AgentChatSummary;
type ChatMessage = app.OllamaMessage;
type OllamaModel = app.OllamaModel;

export function AgentView() {
  const [activeChat, setActiveChat] = useState<AgentChat | null>(null);
  const [chatSummaries, setChatSummaries] = useState<AgentChatSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canSend = input.trim().length > 0 && selectedModel && !sending;
  const modelLabel = selectedModel || "Select model";
  const sortedModels = useMemo(
    () => [...models].sort((left, right) => left.name.localeCompare(right.name)),
    [models],
  );

  useEffect(() => {
    void refreshModels();
    void refreshChats();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function refreshModels() {
    setLoadingModels(true);
    setError("");
    try {
      const nextModels = (await ListOllamaModels()) as OllamaModel[];
      setModels(nextModels);
      if (!selectedModel && nextModels[0]?.name) {
        setSelectedModel(nextModels[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingModels(false);
    }
  }

  async function refreshChats() {
    setError("");
    try {
      const chats = (await ListAgentChats()) as AgentChatSummary[];
      setChatSummaries(chats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadChat(id: string) {
    setError("");
    try {
      const chat = (await LoadAgentChat(id)) as AgentChat;
      setActiveChat(chat);
      setMessages(chat.messages ?? []);
      if (chat.model) setSelectedModel(chat.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function newChat() {
    setActiveChat(null);
    setMessages([]);
    setInput("");
    setError("");
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || !selectedModel || sending) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setSending(true);
    try {
      const draftChat = (await SaveAgentChat({
        id: activeChat?.id ?? "",
        title: activeChat?.title ?? "",
        model: selectedModel,
        messages: nextMessages,
        createdAt: activeChat?.createdAt,
        updatedAt: activeChat?.updatedAt,
      } as AgentChat)) as AgentChat;
      setActiveChat(draftChat);
      void refreshChats();

      const reply = (await ChatOllama(
        selectedModel,
        draftChat.messages ?? nextMessages,
      )) as ChatMessage;
      const finalMessages = [...(draftChat.messages ?? nextMessages), reply];
      const savedChat = (await SaveAgentChat({
        ...draftChat,
        messages: finalMessages,
      } as AgentChat)) as AgentChat;
      setActiveChat(savedChat);
      setMessages(savedChat.messages ?? finalMessages);
      void refreshChats();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages(nextMessages);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 bg-card">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
        <div className="flex h-12 items-center justify-between gap-2 px-3">
          <div className="min-w-0 truncate text-sm font-semibold">
            Recent chats
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={newChat}
            aria-label="New chat"
          >
            <Plus className="size-3" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {chatSummaries.length === 0 ? (
            <div className="px-2 text-xs text-muted-foreground">
              No recent chats
            </div>
          ) : null}

          <div className="grid gap-1">
            {chatSummaries.map((chat) => (
              <Button
                key={chat.id}
                variant={chat.id === activeChat?.id ? "secondary" : "ghost"}
                size="sm"
                className="h-auto min-w-0 justify-start px-2 py-1 text-left"
                onClick={() => void loadChat(chat.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {chat.title || "New chat"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {chat.model || "No model"}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Bot className="size-4" />
                Select a model and start chatting.
              </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-3xl gap-3">
              {messages.map((message, index) => (
                <ChatBubble key={index} message={message} />
              ))}
              {sending ? (
                <div className="justify-self-start text-sm text-muted-foreground">
                  Thinking...
                </div>
              ) : null}
            </div>
          )}
        </div>

        {error ? (
          <div className="border-t px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="border-t bg-muted/30 p-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModelDialogOpen(true);
                void refreshModels();
              }}
              className="max-w-48"
            >
              <span className="truncate">{modelLabel}</span>
            </Button>

            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                event.preventDefault();
                void sendMessage();
              }}
              placeholder="Message Ollama"
              className="max-h-40 min-h-10 resize-none"
              disabled={!selectedModel || sending}
            />

            <Button onClick={() => void sendMessage()} disabled={!canSend}>
              <Send className="size-4" />
              Send
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select model</DialogTitle>
            <DialogDescription>
              Installed Ollama models on this machine.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-80 gap-1 overflow-auto">
            {loadingModels ? (
              <div className="p-2 text-sm text-muted-foreground">
                Loading models...
              </div>
            ) : null}
            {!loadingModels && sortedModels.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No installed models found.
              </div>
            ) : null}
            {sortedModels.map((model) => (
              <Button
                key={model.name}
                variant={model.name === selectedModel ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => {
                  setSelectedModel(model.name);
                  setModelDialogOpen(false);
                }}
              >
                <span className="truncate">{model.name}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={[
        "max-w-[80%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm",
        isUser
          ? "justify-self-end bg-primary text-primary-foreground"
          : "justify-self-start bg-muted text-foreground",
      ].join(" ")}
    >
      {message.content}
    </div>
  );
}
