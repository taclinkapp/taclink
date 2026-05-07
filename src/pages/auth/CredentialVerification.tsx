import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Upload, Clock, ShieldCheck, Camera, ImageIcon, FileText, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import splashBg from '@/assets/splash-bg.mp4.asset.json';

const options = [
  { id: 'nra', label: 'NRA Certified Instructor' },
  { id: 'leo', label: 'Law Enforcement / Military (DD-214 or badge)' },
  { id: 'state', label: 'State Firearms Instructor License' },
  { id: 'other', label: 'Other Professional Certification' },
];

const CredentialVerification = () => {
  const nav = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_BYTES = 10 * 1024 * 1024;
  const handleFile = (f: File | null | undefined) => {
    setPickerOpen(false);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'Please choose a file under 10MB.', variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: 'Document required', description: 'Please attach a photo or PDF of your credential.', variant: 'destructive' });
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden">
        <video
          src={splashBg.url}
          autoPlay loop muted playsInline aria-hidden
          className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
        />
        <div aria-hidden className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none" />
        <div className="relative z-10">
        <PageHeader title="Under Review" />
        <div className="max-w-md mx-auto px-6 py-12 text-center">
          <div className="h-20 w-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-6">
            <Clock className="h-9 w-9 text-primary" />
          </div>
          <h1 className="text-2xl font-black mb-2">Credentials Under Review</h1>
          <p className="text-muted-foreground text-sm mb-2">Our AI verification reviews submissions within 1 hour.</p>
          <p className="text-muted-foreground text-sm mb-8">We'll notify you the moment you're approved.</p>
          <div className="tactical-card p-4 text-left text-xs text-muted-foreground space-y-2 mb-8">
            <div className="flex items-center justify-between"><span>Status</span><span className="text-primary font-bold uppercase tracking-wider">Pending</span></div>
            <div className="flex items-center justify-between"><span>Estimated</span><span className="text-foreground">~45 minutes</span></div>
          </div>
          <Button onClick={() => nav('/instructor')} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            Continue to Dashboard
          </Button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <video
        src={splashBg.url}
        autoPlay loop muted playsInline aria-hidden
        className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
      />
      <div aria-hidden className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none" />
      <div className="relative z-10">
      <PageHeader title="Verify Credentials" back backTo="/instructor/credentials" />
      <div className="max-w-md mx-auto px-6 py-6">
        <div className="flex items-start gap-3 mb-6">
          <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Upload a document proving your qualifications. AI reviews submissions within 1 hour.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Credential Type</Label>
            <RadioGroup defaultValue="nra" className="space-y-2">
              {options.map((o) => (
                <label key={o.id} className="tactical-card p-4 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition">
                  <RadioGroupItem value={o.id} id={o.id} />
                  <span className="text-sm font-medium">{o.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Upload Document</Label>

            {/* Hidden inputs — separate ones so each triggers the right native picker */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {file ? (
              <div className="tactical-card p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center shrink-0">
                  {file.type.startsWith('image/')
                    ? <ImageIcon className="h-5 w-5 text-primary" />
                    : <FileText className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="h-8 w-8 grid place-items-center rounded-md hover:bg-muted transition"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : pickerOpen ? (
              <div className="tactical-card p-4 space-y-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-primary/10 transition text-left"
                >
                  <Camera className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold">Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-primary/10 transition text-left"
                >
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold">Choose from Photos</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-primary/10 transition text-left"
                >
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold">Choose PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="w-full text-xs text-muted-foreground py-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full h-32 tactical-card border-dashed border-primary/40 flex flex-col items-center justify-center gap-2 hover:border-primary transition"
              >
                <Upload className="h-6 w-6 text-primary" />
                <span className="text-sm font-semibold">Choose photo or PDF</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, or PDF up to 10MB</span>
              </button>
            )}
          </div>
          <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            Submit for Review
          </Button>
        </form>
      </div>
      </div>
    </div>
  );
};

export default CredentialVerification;
