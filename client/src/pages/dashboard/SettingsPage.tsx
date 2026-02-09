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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  User,
  Bell,
  Shield,
  Globe,
  Bot,
  Volume2,
  Save,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";

const SettingsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingAI, setSavingAI] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: user?.email || "",
    company: "",
    timezone: "Europe/Berlin",
  });

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
          name: s.display_name || user?.email?.split("@")[0] || "",
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
      } else {
        // API failed or no data - use email as fallback for display name
        setProfileForm((prev) => ({
          ...prev,
          name: user?.email?.split("@")[0] || "",
        }));
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
        description: "Your profile settings have been saved",
      });
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
        description: "Your notification preferences have been saved",
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
        description: "Your AI configuration has been saved",
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
          >
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Profile Settings
                </CardTitle>
                <CardDescription>
                  Manage your account information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, email: e.target.value })
                      }
                    />
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
                        <SelectItem value="America/Los_Angeles">
                          America/Los Angeles (PST)
                        </SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
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
          >
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Manage your account security and authentication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-secondary/30">
                  <h4 className="font-medium text-foreground mb-2">
                    Change Password
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Update your password to keep your account secure
                  </p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input id="currentPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input id="confirmPassword" type="password" />
                    </div>
                    <Button>Update Password</Button>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-secondary/30">
                  <h4 className="font-medium text-foreground mb-2">
                    Two-Factor Authentication
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add an extra layer of security to your account
                  </p>
                  <Button variant="outline">Enable 2FA</Button>
                </div>

                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <h4 className="font-medium text-red-500 mb-2">Danger Zone</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all associated data
                  </p>
                  <Button variant="destructive">Delete Account</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
