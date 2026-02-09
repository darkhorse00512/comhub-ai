import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Bell,
  Shield,
  Globe,
  Bot,
  Volume2,
  Save,
  Loader2,
  Mail,
  Lock,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";

const SettingsPage = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingAI, setSavingAI] = useState(false);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: user?.email || "",
    company: "",
    timezone: "Europe/Berlin",
  });

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailChangeRequested, setEmailChangeRequested] = useState(false);

  // Password change
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    callAlerts: true,
    weeklyReport: false,
    marketingEmails: false,
  });

  const [aiSettings, setAiSettings] = useState({
    voiceModel: "alloy",
    language: "en-US",
    greeting: "Hey there! Here is ComHub AI. What can I help you with today?",
    maxCallDuration: "30",
    silenceTimeout: "2",
  });

  // Load settings from API on mount
  useEffect(() => {
    const loadSettings = async () => {
      const response = await api.getSettings();
      if (response.data) {
        const s = response.data;
        setProfileForm({
          name: s.display_name || "",
          email: user?.email || "",
          company: s.company || "",
          timezone: s.timezone || "Europe/Berlin",
        });
        setNotificationSettings({
          emailNotifications: s.email_notifications ?? true,
          callAlerts: s.call_alerts ?? true,
          weeklyReport: s.weekly_report ?? false,
          marketingEmails: s.marketing_emails ?? false,
        });
        setAiSettings({
          voiceModel: s.ai_voice_model || "alloy",
          language: s.ai_language || "en-US",
          greeting: s.ai_greeting || "Hey there! Here is ComHub AI. What can I help you with today?",
          maxCallDuration: s.ai_max_call_duration?.toString() || "30",
          silenceTimeout: s.ai_silence_timeout?.toString() || "2",
        });
      }
      setLoadingSettings(false);
    };
    loadSettings();
  }, [user]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const response = await api.updateSettings({
      display_name: profileForm.name,
      company: profileForm.company,
      timezone: profileForm.timezone,
    });
    setSavingProfile(false);

    if (response.error) {
      toast({
        title: "Error saving profile",
        description: response.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile settings have been saved.",
      });
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter a new email address.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (newEmail === user?.email) {
      toast({
        title: "Same email",
        description: "New email is the same as your current email.",
        variant: "destructive",
      });
      return;
    }

    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        toast({
          title: "Failed to change email",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setEmailChangeRequested(true);
        setNewEmail("");
        toast({
          title: "Confirmation email sent",
          description: "Please check your new email inbox and click the confirmation link to complete the change.",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
    setChangingEmail(false);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      toast({
        title: "Current password required",
        description: "Please enter your current password.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordForm.newPassword) {
      toast({
        title: "New password required",
        description: "Please enter a new password.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    try {
      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        toast({
          title: "Incorrect current password",
          description: "The current password you entered is wrong.",
          variant: "destructive",
        });
        setChangingPassword(false);
        return;
      }

      // Current password verified, now update to new password
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) {
        toast({
          title: "Failed to update password",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        toast({
          title: "Password updated",
          description: "Your password has been changed successfully.",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
    setChangingPassword(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;

    setDeletingAccount(true);
    try {
      const response = await api.deleteAccount();

      if (response.error) {
        toast({
          title: "Failed to delete account",
          description: response.error,
          variant: "destructive",
        });
        setDeletingAccount(false);
        return;
      }

      // Sign out from Supabase Auth
      await supabase.auth.signOut();
      localStorage.removeItem("backend_token");

      toast({
        title: "Account deleted",
        description: "Your account and all data have been permanently deleted.",
      });

      // signOut will redirect to login
      await signOut();
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setDeletingAccount(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    const response = await api.updateSettings({
      email_notifications: notificationSettings.emailNotifications,
      call_alerts: notificationSettings.callAlerts,
      weekly_report: notificationSettings.weeklyReport,
      marketing_emails: notificationSettings.marketingEmails,
    });
    setSavingNotifications(false);

    if (response.error) {
      toast({
        title: "Error saving notifications",
        description: response.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Notifications updated",
        description: "Your notification preferences have been saved.",
      });
    }
  };

  const handleSaveAI = async () => {
    setSavingAI(true);
    const response = await api.updateSettings({
      ai_voice_model: aiSettings.voiceModel,
      ai_language: aiSettings.language,
      ai_greeting: aiSettings.greeting,
      ai_max_call_duration: parseInt(aiSettings.maxCallDuration) || 30,
      ai_silence_timeout: parseInt(aiSettings.silenceTimeout) || 2,
    });
    setSavingAI(false);

    if (response.error) {
      toast({
        title: "Error saving AI settings",
        description: response.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "AI settings updated",
        description: "Your AI configuration has been saved.",
      });
    }
  };

  if (loadingSettings) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </motion.div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">AI Config</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Profile Information */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your display name, company, and timezone
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      placeholder="Your display name"
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentEmail">Current Email</Label>
                    <Input
                      id="currentEmail"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      To change your email, use the section below
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      placeholder="Your company name"
                      value={profileForm.company}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, company: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={profileForm.timezone}
                      onValueChange={(value) =>
                        setProfileForm({ ...profileForm, timezone: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Berlin">
                          Europe/Berlin (CET)
                        </SelectItem>
                        <SelectItem value="Europe/London">
                          Europe/London (GMT)
                        </SelectItem>
                        <SelectItem value="America/New_York">
                          America/New York (EST)
                        </SelectItem>
                        <SelectItem value="America/Chicago">
                          America/Chicago (CST)
                        </SelectItem>
                        <SelectItem value="America/Los_Angeles">
                          America/Los Angeles (PST)
                        </SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                        <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
                        <SelectItem value="Australia/Sydney">Australia/Sydney (AEST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingProfile ? "Saving..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>

            {/* Change Email */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Change Email Address
                </CardTitle>
                <CardDescription>
                  A confirmation link will be sent to your new email address
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailChangeRequested && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-500">Confirmation email sent</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Check your new email inbox and click the confirmation link to complete the change.
                        Your email won't change until you confirm.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="newEmail">New Email Address</Label>
                  <div className="flex gap-3">
                    <Input
                      id="newEmail"
                      type="email"
                      placeholder="Enter your new email address"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleChangeEmail}
                      disabled={changingEmail || !newEmail.trim()}
                      className="gap-2 shrink-0"
                    >
                      {changingEmail ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      {changingEmail ? "Sending..." : "Send Confirmation"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div>
                      <p className="font-medium text-foreground">
                        Email Notifications
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Receive important updates via email
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          emailNotifications: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div>
                      <p className="font-medium text-foreground">Call Alerts</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified about incoming calls
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.callAlerts}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          callAlerts: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div>
                      <p className="font-medium text-foreground">Weekly Report</p>
                      <p className="text-sm text-muted-foreground">
                        Receive weekly usage summary
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.weeklyReport}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          weeklyReport: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div>
                      <p className="font-medium text-foreground">
                        Marketing Emails
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Receive product updates and tips
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.marketingEmails}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          marketingEmails: checked,
                        })
                      }
                    />
                  </div>
                </div>

                <Button onClick={handleSaveNotifications} disabled={savingNotifications} className="gap-2">
                  {savingNotifications ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingNotifications ? "Saving..." : "Save Preferences"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* AI Config Tab */}
        <TabsContent value="ai">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  AI Configuration
                </CardTitle>
                <CardDescription>
                  Customize how the AI assistant behaves during calls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="voice">Voice Model</Label>
                    <Select
                      value={aiSettings.voiceModel}
                      onValueChange={(value) =>
                        setAiSettings({ ...aiSettings, voiceModel: value })
                      }
                    >
                      <SelectTrigger>
                        <Volume2 className="w-4 h-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                        <SelectItem value="echo">Echo (Male)</SelectItem>
                        <SelectItem value="fable">Fable (British)</SelectItem>
                        <SelectItem value="onyx">Onyx (Deep Male)</SelectItem>
                        <SelectItem value="nova">Nova (Female)</SelectItem>
                        <SelectItem value="shimmer">Shimmer (Soft Female)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={aiSettings.language}
                      onValueChange={(value) =>
                        setAiSettings({ ...aiSettings, language: value })
                      }
                    >
                      <SelectTrigger>
                        <Globe className="w-4 h-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-GB">English (UK)</SelectItem>
                        <SelectItem value="de-DE">German</SelectItem>
                        <SelectItem value="es-ES">Spanish</SelectItem>
                        <SelectItem value="fr-FR">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="greeting">AI Greeting Message</Label>
                  <Textarea
                    id="greeting"
                    value={aiSettings.greeting}
                    onChange={(e) =>
                      setAiSettings({ ...aiSettings, greeting: e.target.value })
                    }
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This message will be spoken when the AI answers a call
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxDuration">
                      Max Call Duration (seconds)
                    </Label>
                    <Input
                      id="maxDuration"
                      type="number"
                      value={aiSettings.maxCallDuration}
                      onChange={(e) =>
                        setAiSettings({
                          ...aiSettings,
                          maxCallDuration: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="silenceTimeout">
                      Silence Timeout (seconds)
                    </Label>
                    <Input
                      id="silenceTimeout"
                      type="number"
                      value={aiSettings.silenceTimeout}
                      onChange={(e) =>
                        setAiSettings({
                          ...aiSettings,
                          silenceTimeout: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <Button onClick={handleSaveAI} disabled={savingAI} className="gap-2">
                  {savingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingAI ? "Saving..." : "Save AI Settings"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Change Password */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter your current password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password (min. 6 characters)"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {passwordForm.newPassword && passwordForm.confirmPassword && (
                  <div className="flex items-center gap-2 text-sm">
                    {passwordForm.newPassword === passwordForm.confirmPassword ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-green-500">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-red-500">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  className="gap-2"
                >
                  {changingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {changingPassword ? "Updating..." : "Update Password"}
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="bg-card/50 backdrop-blur border-red-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions that permanently affect your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <h4 className="font-medium text-red-500 mb-2">Delete Account</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all associated data including agents,
                    call history, phone numbers, and settings. This action cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data will be deleted including:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>Your profile and settings</li>
              <li>All AI agents and workflows</li>
              <li>Call history and recordings</li>
              <li>Phone numbers and configurations</li>
            </ul>

            <div className="space-y-2 pt-2">
              <Label htmlFor="deleteConfirm" className="text-sm">
                Type <span className="font-bold text-red-500">DELETE</span> to confirm
              </Label>
              <Input
                id="deleteConfirm"
                placeholder="Type DELETE to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="border-red-500/30 focus-visible:ring-red-500/30"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deletingAccount}
              className="gap-2"
            >
              {deletingAccount ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {deletingAccount ? "Deleting..." : "Delete Account Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
