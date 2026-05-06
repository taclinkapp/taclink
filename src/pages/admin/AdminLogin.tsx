import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

const AdminLogin = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo showTagline widthPx={180} />
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mt-2 flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" /> Admin Access
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); nav('/admin'); }} className="tactical-card p-6 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Admin Email</Label>
            <Input type="email" className="bg-background border-border h-11 mt-1.5" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input type="password" className="bg-background border-border h-11 mt-1.5" />
          </div>
          <Button type="submit" className="w-full h-11 bg-primary text-primary-foreground font-bold">Sign In to Admin</Button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-4">Authorized personnel only.</p>
      </div>
    </div>
  );
};

export default AdminLogin;
