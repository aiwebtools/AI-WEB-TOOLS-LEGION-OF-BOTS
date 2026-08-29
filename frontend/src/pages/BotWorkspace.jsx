import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Send, Plus, Star, ImageIcon, X, Loader2, Download, ChevronLeft, ChevronRight,
  Square, Copy, RefreshCw, Check, Cpu, ArrowLeft, Trash2, Paperclip, FileText,
} from "lucide-react";
import api, { API, getToken } from "@/lib/api";
import { iconFor } from "@/lib/icons";
import { CapabilityBadges } from "@/components/BotCard";
import Markdown from "@/components/Markdown";
import { toast } from "sonner";

const GEN_BLOCK_RE = /```generate-file[\s\S]*?```/g;
const stripGen = (t) => (t || "").replace(GEN_BLOCK_RE, "").trim();

export default function BotWorkspace() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [bot, setBot] = useState(null);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(null);
  const [convId, setConvId] = useState(params.get("c") || null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState([]);
  const [docs, setDocs] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [fav, setFav] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const taRef = useRef(null);

  const loadConversations = useCallback(async (botId) => {
    const { data } = await api.get("/conversations");
    setConversations(data.filter((c) => c.bot_id === botId));
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) { setMessages([]); return; }
    try { const { data } = await api.get(`/conversations/${id}`); setMessages(data.messages); setModel(data.conversation.model); }
    catch { setMessages([]); }
  }, []);

  useEffect(() => {
    api.get(`/bots/${slug}`).then(({ data }) => {
      setBot(data); setFav(!!data.is_favorite); setModel((m) => m || data.default_model);
      loadConversations(data.id);
    }).catch(() => navigate("/bots"));
    api.get("/models").then(({ data }) => setModels(data)).catch(() => {});
  }, [slug, navigate, loadConversations]);

  useEffect(() => { loadMessages(convId); }, [convId, loadMessages]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, streamText]);

  const toggleFav = async () => {
    if (fav) { await api.delete(`/favorites/${bot.id}`); setFav(false); }
    else { await api.post(`/favorites/${bot.id}`); setFav(true); }
  };

  const newChat = () => { setConvId(null); setMessages([]); setStreamText(""); navigate(`/bot/${slug}`); };

  const onFile = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    files.forEach((f) => {
      if (!f.type.startsWith("image/")) { toast.error("Only images are supported for attachment."); return; }
      const reader = new FileReader();
      reader.onload = () => setImages((imgs) => [...imgs, { name: f.name, dataUrl: reader.result, b64: String(reader.result).split(",")[1] }]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const onDoc = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    files.forEach((f) => {
      if (f.size > 15 * 1024 * 1024) { toast.error(`${f.name} is too large (max 15MB).`); return; }
      const reader = new FileReader();
      reader.onload = () => setDocs((d) => [...d, { name: f.name, mime: f.type || "application/octet-stream", data: String(reader.result).split(",")[1] }]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const stop = () => { if (abortRef.current) abortRef.current.abort(); };

  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;
    const sendImages = bot?.capabilities?.image ? images.map((i) => i.b64) : [];
    const sendDocs = bot?.capabilities?.files ? docs.map((d) => ({ name: d.name, mime: d.mime, data: d.data })) : [];
    const userMsg = { id: `tmp-${Date.now()}`, role: "user", content: text, images: images.map((i) => i.dataUrl), attachments: docs.map((d) => ({ name: d.name, mime: d.mime })) };
    setMessages((m) => [...m, userMsg]);
    setInput(""); setImages([]); setDocs([]); setStreaming(true); setStreamText("");
    if (taRef.current) taRef.current.style.height = "auto";

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    let genFile = null;
    let newConvId = convId;

    try {
      const resp = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ bot_slug: slug, conversation_id: convId, message: text, model, images: sendImages, files: sendDocs }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("stream failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.type === "start") { newConvId = evt.conversation_id; if (!convId) setConvId(evt.conversation_id); }
          else if (evt.type === "delta") { acc += evt.content; setStreamText(acc); }
          else if (evt.type === "file") { genFile = evt.file; }
          else if (evt.type === "error") { acc += `\n\n> ⚠️ ${evt.content}`; setStreamText(acc); toast.error("AI provider error"); }
          else if (evt.type === "done") { /* finalize */ }
        }
      }
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: stripGen(acc), model, generated_file: genFile }]);
      setStreamText("");
      if (newConvId && newConvId !== convId) { navigate(`/bot/${slug}?c=${newConvId}`, { replace: true }); }
      loadConversations(bot.id);
    } catch (err) {
      if (err.name !== "AbortError") { toast.error("Connection error. Please try again."); }
      if (acc) setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: stripGen(acc), model, generated_file: genFile }]);
      setStreamText("");
    } finally { setStreaming(false); abortRef.current = null; }
  };

  const regenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) send(lastUser.content);
  };

  const copyMsg = (id, text) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); };

  const download = (fileId) => window.open(`${API}/files/${fileId}/download?token=${getToken()}`, "_blank");

  const deleteConv = async (id, e) => { e.stopPropagation(); await api.delete(`/conversations/${id}`); setConversations((c) => c.filter((x) => x.id !== id)); if (id === convId) newChat(); };

  if (!bot) return <div className="h-full flex items-center justify-center text-muted-foreground font-mono"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading bot...</div>;
  const Icon = iconFor(bot.icon);

  const suggestions = (bot.suggested_prompts && bot.suggested_prompts.length)
    ? bot.suggested_prompts
    : [
        `What can you help me with?`,
        `Walk me through your process step by step.`,
        bot.capabilities.document_generation ? `Create a document I can download.` : `Give me a detailed example.`,
        `What information do you need from me to start?`,
      ];

  return (
    <div className="h-full flex overflow-hidden">
      {/* LEFT: conversations */}
      <aside className={`${leftOpen ? "w-64" : "w-0"} transition-all duration-200 border-r border-border bg-[#070707] overflow-hidden shrink-0 hidden md:block`}>
        <div className="w-64 h-full flex flex-col">
          <div className="p-3 border-b border-border">
            <button onClick={() => navigate("/bots")} className="text-xs font-mono text-muted-foreground hover:text-matrix flex items-center gap-1 mb-3"><ArrowLeft className="w-3 h-3" /> All Bots</button>
            <button onClick={newChat} data-testid="new-chat-btn" className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-matrix text-black font-bold rounded-sm hover:bg-matrix-dark transition-colors text-sm"><Plus className="w-4 h-4" /> New Chat</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 && <div className="text-xs text-muted-foreground font-mono p-2">No conversations yet.</div>}
            {conversations.map((c) => (
              <div key={c.id} onClick={() => setConvId(c.id)} data-testid={`ws-conv-${c.id}`} className={`group flex items-center gap-2 px-2 py-2 rounded-sm cursor-pointer text-sm transition-colors ${c.id === convId ? "bg-matrix/15 text-matrix" : "text-muted-foreground hover:bg-secondary hover:text-white"}`}>
                <span className="flex-1 truncate">{c.title}</span>
                <button onClick={(e) => deleteConv(c.id, e)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* CENTER */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-black/60 backdrop-blur-md">
          <button onClick={() => setLeftOpen((o) => !o)} className="hidden md:block text-muted-foreground hover:text-matrix">{leftOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
          <div className="w-9 h-9 flex items-center justify-center border border-border rounded-sm bg-matrix/5 text-matrix shrink-0"><Icon className="w-4 h-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-white truncate">{bot.name}</div>
            <div className="text-[10px] font-mono text-matrix/60">{bot.suite_label}</div>
          </div>
          <select data-testid="model-selector" value={model || ""} onChange={(e) => setModel(e.target.value)} className="px-2 py-1.5 bg-input border border-border rounded-sm text-white font-mono text-xs outline-none focus:border-matrix">
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button onClick={toggleFav} data-testid="ws-fav-btn" className="p-1.5 text-muted-foreground hover:text-matrix"><Star className={`w-4 h-4 ${fav ? "fill-matrix text-matrix" : ""}`} /></button>
          <button onClick={() => setRightOpen((o) => !o)} className="p-1.5 text-muted-foreground hover:text-matrix" title="Bot info"><Cpu className="w-4 h-4" /></button>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && !streaming && (
              <div className="text-center py-10" data-testid="ws-empty">
                <div className="w-14 h-14 mx-auto flex items-center justify-center border border-matrix/40 rounded-sm bg-matrix/5 text-matrix box-glow mb-4"><Icon className="w-7 h-7" /></div>
                <h2 className="font-display font-bold text-xl text-white mb-2">What would you like to accomplish with {bot.name}?</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">{bot.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                  {suggestions.map((s, i) => (
                    <button key={i} data-testid={`suggestion-${i}`} onClick={() => send(s)} className="text-left px-3 py-2.5 border border-border rounded-sm text-sm text-muted-foreground hover:border-matrix/50 hover:text-white transition-colors">{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} data-testid={`message-${m.role}`} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] bg-card border border-border rounded-sm px-4 py-3">
                    {m.images?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">{m.images.map((src, i) => <img key={i} src={src} alt="" className="w-24 h-24 object-cover rounded-sm border border-border" />)}</div>
                    )}
                    {m.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">{m.attachments.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 bg-input border border-border rounded-sm px-2 py-1 text-xs text-matrix/90"><FileText className="w-3.5 h-3.5" />{a.name}</span>
                      ))}</div>
                    )}
                    <div className="text-sm text-white whitespace-pre-wrap">{m.content}</div>
                  </div>
                ) : (
                  <div className="group border-l-2 border-matrix pl-4">
                    <Markdown content={m.content} />
                    {m.generated_file && (
                      <button onClick={() => download(m.generated_file.id)} data-testid="download-file-btn" className="mt-3 inline-flex items-center gap-2 px-3 py-2 border border-matrix/50 text-matrix rounded-sm hover:bg-matrix hover:text-black transition-colors text-sm font-mono">
                        <Download className="w-4 h-4" /> {m.generated_file.filename} ({(m.generated_file.size / 1024).toFixed(1)} KB)
                      </button>
                    )}
                    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => copyMsg(m.id, m.content)} className="text-muted-foreground hover:text-matrix" title="Copy">{copiedId === m.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
                      <button onClick={regenerate} className="text-muted-foreground hover:text-matrix" title="Regenerate"><RefreshCw className="w-3.5 h-3.5" /></button>
                      {m.model && <span className="text-[10px] font-mono text-muted-foreground">{models.find((x) => x.id === m.model)?.label || m.model}</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {streaming && (
              <div className="border-l-2 border-matrix pl-4" data-testid="streaming-message">
                {streamText ? <div className="cursor-blink"><Markdown content={stripGen(streamText)} /></div> : <div className="flex items-center gap-2 text-matrix font-mono text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</div>}
              </div>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="border-t border-border bg-black/60 backdrop-blur-md px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.dataUrl} alt="" className="w-16 h-16 object-cover rounded-sm border border-border" />
                    <button onClick={() => setImages((im) => im.filter((_, x) => x !== i))} className="absolute -top-1 -right-1 w-5 h-5 bg-black border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {docs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {docs.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 bg-input border border-border rounded-sm px-2 py-1.5" data-testid={`doc-chip-${i}`}>
                    <FileText className="w-4 h-4 text-matrix shrink-0" />
                    <span className="text-xs text-white max-w-[160px] truncate">{d.name}</span>
                    <button onClick={() => setDocs((dd) => dd.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 bg-input border border-border rounded-sm px-3 py-2 focus-within:border-matrix/50 transition-colors">
              {bot.capabilities.image ? (
                <label className="p-1.5 text-muted-foreground hover:text-matrix cursor-pointer" title="Attach image" data-testid="attach-image-btn">
                  <ImageIcon className="w-5 h-5" />
                  <input type="file" accept="image/*" multiple hidden onChange={onFile} data-testid="image-input" />
                </label>
              ) : (
                <span className="p-1.5 text-muted-foreground/40" title="Image analysis unavailable for this bot"><ImageIcon className="w-5 h-5" /></span>
              )}
              {bot.capabilities.files && (
                <label className="p-1.5 text-muted-foreground hover:text-matrix cursor-pointer" title="Attach file (PDF, CSV, TXT, DOCX, XLSX)" data-testid="attach-doc-btn">
                  <Paperclip className="w-5 h-5" />
                  <input type="file" accept=".pdf,.csv,.txt,.md,.json,.docx,.xlsx,.doc,.xls" multiple hidden onChange={onDoc} data-testid="doc-input" />
                </label>
              )}
              <textarea
                ref={taRef}
                data-testid="chat-input"
                value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder={`Message ${bot.name}...`}
                className="flex-1 bg-transparent outline-none text-white resize-none py-1.5 max-h-[200px] text-sm"
              />
              {streaming ? (
                <button onClick={stop} data-testid="stop-btn" className="p-2 bg-destructive/20 text-destructive rounded-sm hover:bg-destructive/30 transition-colors"><Square className="w-4 h-4" /></button>
              ) : (
                <button onClick={() => send()} disabled={!input.trim()} data-testid="send-btn" className="p-2 bg-matrix text-black rounded-sm hover:bg-matrix-dark transition-colors disabled:opacity-40"><Send className="w-4 h-4" /></button>
              )}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1.5 text-center">Bot follows its own operational instructions · {models.find((m) => m.id === model)?.label}</div>
          </div>
        </div>
      </div>

      {/* RIGHT panel */}
      {rightOpen && (
        <aside className="w-72 border-l border-border bg-[#070707] shrink-0 overflow-y-auto hidden lg:block">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4"><h3 className="font-display font-bold text-white">Bot Details</h3><button onClick={() => setRightOpen(false)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button></div>
            <div className="w-12 h-12 flex items-center justify-center border border-border rounded-sm bg-matrix/5 text-matrix mb-3"><Icon className="w-6 h-6" /></div>
            <div className="font-display font-bold text-white mb-1">{bot.name}</div>
            <div className="text-[10px] font-mono text-matrix/60 mb-3">{bot.suite_label}</div>
            <p className="text-sm text-muted-foreground mb-4">{bot.description}</p>
            <div className="text-xs font-mono uppercase text-matrix/60 mb-2">Capabilities</div>
            <CapabilityBadges capabilities={bot.capabilities} limit={10} />
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-mono uppercase text-matrix/60 mb-2">Active Model</div>
              <div className="text-sm text-white">{models.find((m) => m.id === model)?.label}</div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
