import { useEffect, useRef, useState } from "react";
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle, FileArchive, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const STEPS = [
  "Scanning archive...", "Extracting documents...", "Detecting bot names...",
  "Detecting duplicate versions...", "Grouping related instructions...",
  "Building bot catalog...", "Assigning suites...", "Checking capabilities...",
];

export default function ImportManager() {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = () => api.get("/admin/import").then(({ data }) => setHistory(data)).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (!uploading) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => (s < STEPS.length - 1 ? s + 1 : s)), 700);
    return () => clearInterval(t);
  }, [uploading]);

  const upload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) { toast.error("Please choose a .zip archive."); return; }
    setUploading(true); setPreview(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post("/admin/import", form, { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(data);
      toast.success(`Detected ${data.new_count} new bots`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Import failed");
    } finally { setUploading(false); }
  };

  const publish = async () => {
    if (!preview) return;
    setPublishing(true);
    try {
      const { data } = await api.post(`/admin/import/${preview.job_id}/publish`);
      toast.success(`Published ${data.added} bots to the internal library`);
      setPreview(null); loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Publish failed");
    } finally { setPublishing(false); }
  };

  return (
    <div>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
        data-testid="import-dropzone"
        className="border-2 border-dashed border-border rounded-sm p-10 text-center cursor-pointer hover:border-matrix/50 transition-colors bg-card"
      >
        <UploadCloud className="w-8 h-8 text-matrix mx-auto mb-3" />
        <div className="font-display font-bold text-white mb-1">Upload an operational-instruction ZIP</div>
        <p className="text-sm text-muted-foreground">Drag &amp; drop or click to select. DOCX / TXT / MD supported. Source files are never overwritten.</p>
        <input ref={fileRef} type="file" accept=".zip" hidden data-testid="import-file-input" onChange={(e) => upload(e.target.files?.[0])} />
      </div>

      {uploading && (
        <div className="mt-6 bg-card border border-border rounded-sm p-6" data-testid="import-progress">
          <div className="flex items-center gap-2 text-matrix font-mono text-sm mb-4"><Loader2 className="w-4 h-4 animate-spin" /> {STEPS[step]}</div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-matrix transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        </div>
      )}

      {preview && (
        <div className="mt-6 bg-card border border-matrix/40 rounded-sm border-glow p-6" data-testid="import-preview">
          <div className="flex items-center gap-2 mb-4"><FileArchive className="w-5 h-5 text-matrix" /><span className="font-display font-bold text-white">{preview.filename}</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[["Source Files", preview.total_source_files], ["Detected Bots", preview.detected_bots.length], ["New", preview.new_count], ["Duplicates", preview.duplicate_count]].map(([l, v]) => (
              <div key={l} className="bg-input border border-border rounded-sm p-3"><div className="font-display font-black text-xl text-white">{v}</div><div className="text-[10px] font-mono uppercase text-muted-foreground">{l}</div></div>
            ))}
          </div>
          <div className="max-h-72 overflow-y-auto border border-border rounded-sm mb-4">
            {preview.detected_bots.map((b, i) => (
              <div key={`${b.slug}-${i}`} className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-0" data-testid={`import-bot-${i}`}>
                {b.status === "new" ? <Sparkles className="w-4 h-4 text-matrix shrink-0" /> : <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />}
                <span className="text-sm text-white flex-1 truncate">{b.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">{b.suite_label}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm ${b.status === "new" ? "text-matrix bg-matrix/10" : "text-yellow-500 bg-yellow-500/10"}`}>{b.status}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={publish} disabled={publishing || preview.new_count === 0} data-testid="import-publish-btn" className="inline-flex items-center gap-2 px-4 py-2 bg-matrix text-black font-bold rounded-sm hover:bg-matrix-dark transition-colors disabled:opacity-50">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Publish {preview.new_count} New Bots
            </button>
            <button onClick={() => setPreview(null)} className="px-4 py-2 border border-border rounded-sm text-muted-foreground hover:text-white transition-colors">Cancel</button>
            <span className="text-xs text-muted-foreground font-mono">New bots publish to the internal library; activate them from the Bots tab.</span>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display font-bold text-white mb-3">Import History</h3>
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            {history.map((j) => (
              <div key={j.id} className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-0 text-sm">
                <FileArchive className="w-4 h-4 text-matrix/70" />
                <span className="text-white flex-1 truncate">{j.filename}</span>
                <span className="text-xs font-mono text-muted-foreground">{j.new_count} new / {j.duplicate_count} dup</span>
                <span className={`text-[10px] font-mono ${j.published ? "text-matrix" : "text-muted-foreground"}`}>{j.published ? `published +${j.added || 0}` : "pending"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
