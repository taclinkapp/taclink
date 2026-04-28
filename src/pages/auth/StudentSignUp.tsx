import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/MobileShell';
import { Camera } from 'lucide-react';

const StudentSignUp = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Student Sign Up" back />
      <div className="max-w-md mx-auto px-6 py-6">
        <p className="text-muted-foreground text-sm mb-6">Create your free TacLink account to discover and book courses.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nav('/student');
          }}
          className="space-y-4"
        >
          <div className="flex justify-center mb-2">
            <button type="button" className="h-24 w-24 rounded-full bg-card border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition">
              <Camera className="h-7 w-7" />
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input type="password" className="bg-card border-border h-11 mt-1.5" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
            <Input type="password" className="bg-card border-border h-11 mt-1.5" />
          </div>
          <div className="flex items-start gap-3 pt-2">
            <Checkbox id="age" className="mt-0.5" />
            <label htmlFor="age" className="text-xs text-muted-foreground leading-relaxed">
              I confirm I am 18 or older and agree to the <span className="text-primary">Terms of Service</span> and <span className="text-primary">Privacy Policy</span>.
            </label>
          </div>
          <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold mt-4">
            Create Student Account
          </Button>
        </form>
      </div>
    </div>
  );
};

export default StudentSignUp;
