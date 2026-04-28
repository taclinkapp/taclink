import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/MobileShell';
import { Camera } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { US_STATES } from '@/lib/mockData';

const InstructorSignUp = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Instructor Application" back />
      <div className="max-w-md mx-auto px-6 py-6">
        <p className="text-muted-foreground text-sm mb-6">Apply to teach on TacLink. We'll verify your credentials within 1 hour.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nav('/auth/credential-verification');
          }}
          className="space-y-4"
        >
          <div className="flex justify-center mb-2">
            <button type="button" className="h-28 w-28 rounded-full bg-card border-2 border-dashed border-primary/40 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition">
              <Camera className="h-7 w-7" />
              <span className="text-[10px] mt-1 uppercase tracking-wider">Required</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">First Name</Label>
              <Input className="bg-card border-border h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Last Name</Label>
              <Input className="bg-card border-border h-11 mt-1.5" />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
            <Input type="email" className="bg-card border-border h-11 mt-1.5" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone</Label>
            <Input type="tel" className="bg-card border-border h-11 mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input type="password" className="bg-card border-border h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm</Label>
              <Input type="password" className="bg-card border-border h-11 mt-1.5" />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">State</Label>
            <Select>
              <SelectTrigger className="bg-card border-border h-11 mt-1.5"><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent className="bg-card border-border max-h-64">
                {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bio (max 500 chars)</Label>
            <Textarea className="bg-card border-border min-h-24 mt-1.5" placeholder="Tell students about your background and teaching style…" maxLength={500} />
          </div>
          <div className="flex items-start gap-3 pt-2">
            <Checkbox id="age" className="mt-0.5" />
            <label htmlFor="age" className="text-xs text-muted-foreground leading-relaxed">
              I confirm I am 18 or older and agree to the <span className="text-primary">Terms of Service</span> and <span className="text-primary">Privacy Policy</span>.
            </label>
          </div>
          <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold mt-4">
            Apply as Instructor
          </Button>
        </form>
      </div>
    </div>
  );
};

export default InstructorSignUp;
