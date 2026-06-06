import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavHistoryProvider } from "@/contexts/NavHistoryContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Splash is the landing page — keep eager so the first paint is instant
import Splash from "./pages/Splash";

// Everything else is code-split. Each route's bundle only loads when visited.
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const CancellationsFAQ = lazy(() => import("./pages/legal/CancellationsFAQ"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const HelpCenter = lazy(() => import("./pages/support/HelpCenter"));
const ContactSupport = lazy(() => import("./pages/support/ContactSupport"));

const Welcome = lazy(() => import("./pages/onboarding/Welcome"));
const OnboardingQuiz = lazy(() => import("./pages/onboarding/Quiz"));
const OnboardingPlan = lazy(() => import("./pages/onboarding/TrainingPlan"));
const SignIn = lazy(() => import("./pages/auth/SignIn"));
const StudentSignUp = lazy(() => import("./pages/auth/StudentSignUp"));
const InstructorSignUp = lazy(() => import("./pages/auth/InstructorSignUp"));
const CredentialVerification = lazy(() => import("./pages/auth/CredentialVerification"));
const InstructorPlanStep = lazy(() => import("./pages/auth/InstructorPlanStep"));
const InstructorCredentialStep = lazy(() => import("./pages/auth/InstructorCredentialStep"));
const InstructorPolicyStep = lazy(() => import("./pages/auth/InstructorPolicyStep"));
const InviteLanding = lazy(() => import("./pages/auth/InviteLanding"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const ChangePassword = lazy(() => import("./pages/auth/ChangePassword"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const InfluencerLanding = lazy(() => import("./pages/auth/InfluencerLanding"));
const AffiliateDashboard = lazy(() => import("./pages/affiliate/AffiliateDashboard"));
const AffiliatePortal = lazy(() => import("./pages/affiliate/AffiliatePortal"));

const Discover = lazy(() => import("./pages/student/Discover"));
const CourseDetail = lazy(() => import("./pages/student/CourseDetail"));
const Checkout = lazy(() => import("./pages/student/Checkout"));
const CheckoutReturn = lazy(() => import("./pages/student/CheckoutReturn"));
const BookingSuccess = lazy(() => import("./pages/student/BookingSuccess"));
const MyBookings = lazy(() => import("./pages/student/MyBookings"));
const MyProgress = lazy(() => import("./pages/student/MyProgress"));
const OperatorProfile = lazy(() => import("./pages/student/OperatorProfile"));
const BookingDetail = lazy(() => import("./pages/student/BookingDetail"));
const LeaveReview = lazy(() => import("./pages/student/LeaveReview"));
const MyReviews = lazy(() => import("./pages/student/MyReviews"));
const StudentProfile = lazy(() => import("./pages/student/StudentProfile"));
const StudentSettings = lazy(() => import("./pages/student/StudentSettings"));
const PaymentMethods = lazy(() => import("./pages/student/PaymentMethods"));
const StudentMessages = lazy(() => import("./pages/student/StudentMessages"));
const StudentConversation = lazy(() => import("./pages/student/StudentConversation"));

const InstructorDashboard = lazy(() => import("./pages/instructor/InstructorDashboard"));
const MyCourses = lazy(() => import("./pages/instructor/MyCourses"));
const NewCourse = lazy(() => import("./pages/instructor/NewCourse"));
const CourseManagement = lazy(() => import("./pages/instructor/CourseManagement"));
const InstructorProfile = lazy(() => import("./pages/instructor/InstructorProfile"));
const InstructorSettings = lazy(() => import("./pages/instructor/InstructorSettings"));
const PayoutMethods = lazy(() => import("./pages/instructor/PayoutMethods"));
const InstructorMessages = lazy(() => import("./pages/instructor/InstructorMessages"));
const InstructorConversation = lazy(() => import("./pages/instructor/InstructorConversation"));
const InstructorCredentials = lazy(() => import("./pages/instructor/InstructorCredentials"));
const InstructorRoster = lazy(() => import("./pages/instructor/InstructorRoster"));
const InstructorReviews = lazy(() => import("./pages/instructor/InstructorReviews"));
const InstructorSubscription = lazy(() => import("./pages/instructor/InstructorSubscription"));

// Admin routes — large bundle, almost never visited by public users
const AdminLayout = lazy(() =>
  import("./components/AdminLayout").then((m) => ({ default: m.AdminLayout }))
);
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminInstructors = lazy(() =>
  import("./pages/admin/AdminUsers").then((m) => ({ default: m.AdminInstructors }))
);
const AdminUsersReal = lazy(() =>
  import("./pages/admin/AdminUsersReal").then((m) => ({ default: m.AdminUsersReal }))
);
const AdminCoursesReal = lazy(() =>
  import("./pages/admin/AdminCoursesReal").then((m) => ({ default: m.AdminCoursesReal }))
);
const AdminWaivers = lazy(() => import("./pages/admin/AdminWaivers"));
const AdminReliability = lazy(() => import("./pages/admin/AdminReliability"));
const AdminPlatformSettings = lazy(() =>
  import("./pages/admin/AdminPlatformSettings").then((m) => ({ default: m.AdminPlatformSettings }))
);
const AdminFeatureFlags = lazy(() =>
  import("./pages/admin/AdminFeatureFlags").then((m) => ({ default: m.AdminFeatureFlags }))
);
const AdminAuditLog = lazy(() =>
  import("./pages/admin/AdminAuditLog").then((m) => ({ default: m.AdminAuditLog }))
);
const AdminReports = lazy(() =>
  import("./pages/admin/AdminReports").then((m) => ({ default: m.AdminReports }))
);
const AdminSupportTickets = lazy(() =>
  import("./pages/admin/AdminSupportTickets").then((m) => ({ default: m.AdminSupportTickets }))
);
const AdminConversations = lazy(() =>
  import("./pages/admin/AdminConversations").then((m) => ({ default: m.AdminConversations }))
);
const AdminConversationDetail = lazy(() =>
  import("./pages/admin/AdminConversationDetail").then((m) => ({ default: m.AdminConversationDetail }))
);
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration"));
const AdminRefunds = lazy(() => import("./pages/admin/AdminRefunds"));
const AdminFinancials = lazy(() => import("./pages/admin/AdminFinancials"));
const AdminFeaturedCourses = lazy(() => import("./pages/admin/AdminFeaturedCourses"));
const AdminBugTriage = lazy(() => import("./pages/admin/AdminBugTriage"));
const AdminCourseEditor = lazy(() => import("./pages/admin/AdminCourseEditor"));
const AdminFeeOverrides = lazy(() => import("./pages/admin/AdminFeeOverrides"));
const OwnerConsole = lazy(() => import("./pages/admin/OwnerConsole"));
const AdminInfluencerLinks = lazy(() => import("./pages/admin/AdminInfluencerLinks"));
const WeeklyBrief = lazy(() => import("./pages/admin/WeeklyBrief"));
const AdminTestAccounts = lazy(() => import("./pages/admin/AdminTestAccounts"));
const AdminWarriorQuotes = lazy(() => import("./pages/admin/AdminWarriorQuotes"));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminHelcimWebhooks = lazy(() => import("./pages/admin/AdminHelcimWebhooks"));
const AdminRefundTest = lazy(() => import("./pages/admin/AdminRefundTest"));
const AdminUptime = lazy(() => import("./pages/admin/AdminUptime"));
const AdminBackgroundVideos = lazy(() => import("./pages/admin/AdminBackgroundVideos"));
const AdminDepositReview = lazy(() => import("./pages/admin/AdminDepositReview"));
const AdminFeedback = lazy(() => import("./pages/admin/AdminFeedback"));
const AdminSubscriptionPlans = lazy(() => import("./pages/admin/AdminSubscriptionPlans"));
const AdminFoundingInstructors = lazy(() => import("./pages/admin/AdminFoundingInstructors"));
const AdminSEO = lazy(() => import("./pages/admin/AdminSEO"));
const BlogIndex = lazy(() => import("./pages/blog/BlogIndex"));
const BlogPost = lazy(() => import("./pages/blog/BlogPost"));

import { AIAssistantMount } from "./components/AIAssistantMount";
import { InstallAppBanner } from "./components/InstallAppBanner";
import { InstructorOnboardingGate } from "./components/InstructorOnboardingGate";
import { MissionCompleteWatcher } from "./components/operator/MissionCompleteWatcher";
import { MaintenanceBanner } from "./components/MaintenanceBanner";
import { LaunchLiveNotifier } from "./components/LaunchLiveNotifier";

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen grid place-items-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const Student = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="student">{children}</ProtectedRoute>
);
const StudentOrGuest = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="student" allowGuest>{children}</ProtectedRoute>
);
const Instructor = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="instructor">
    <InstructorOnboardingGate>{children}</InstructorOnboardingGate>
  </ProtectedRoute>
);
const Authed = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true } as any}
      >
        <AuthProvider>
          <NavHistoryProvider>
          <MaintenanceBanner />
          <LaunchLiveNotifier />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/welcome/quiz" element={<OnboardingQuiz />} />
            <Route path="/welcome/plan" element={<OnboardingPlan />} />
            <Route path="/onboarding" element={<Navigate to="/welcome" replace />} />
            <Route path="/onboarding/welcome" element={<Navigate to="/welcome" replace />} />
            <Route path="/onboarding/quiz" element={<Navigate to="/welcome/quiz" replace />} />
            <Route path="/onboarding/plan" element={<Navigate to="/welcome/plan" replace />} />
            <Route path="/onboarding/*" element={<Navigate to="/welcome" replace />} />

            {/* Auth */}
            <Route path="/auth" element={<Navigate to="/auth/signin" replace />} />
            <Route path="/auth/signin" element={<SignIn />} />
            <Route path="/auth/student-signup" element={<StudentSignUp />} />
            <Route path="/auth/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/instructor-signup" element={<InstructorSignUp />} />
            <Route path="/auth/credential-verification" element={<CredentialVerification />} />
            <Route path="/auth/instructor/plan" element={<InstructorPlanStep />} />
            <Route path="/auth/instructor/credential" element={<InstructorCredentialStep />} />
            <Route path="/auth/instructor/policy" element={<InstructorPolicyStep />} />
            <Route path="/auth/invite/:code" element={<InviteLanding />}/>
            <Route path="/i/:slug" element={<InfluencerLanding />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/change-password" element={<Authed><ChangePassword /></Authed>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            {/* Student (Discover + CourseDetail allow guest browse) */}
            <Route path="/student" element={<StudentOrGuest><Discover /></StudentOrGuest>} />
            <Route path="/student/discover" element={<Navigate to="/student" replace />} />
            <Route path="/student/course/:id" element={<StudentOrGuest><CourseDetail /></StudentOrGuest>} />
            <Route path="/student/checkout/:id" element={<Student><Checkout /></Student>} />
            <Route path="/student/checkout/:id/return" element={<Student><CheckoutReturn /></Student>} />
            <Route path="/student/booking-success/:id" element={<Student><BookingSuccess /></Student>} />
            <Route path="/student/bookings" element={<Student><MyBookings /></Student>} />
            <Route path="/student/progress" element={<Student><MyProgress /></Student>} />
            <Route path="/student/operator" element={<Student><OperatorProfile /></Student>} />
            <Route path="/student/booking/:id" element={<Student><BookingDetail /></Student>} />
            <Route path="/student/review/:id" element={<Student><LeaveReview /></Student>} />
            <Route path="/student/reviews" element={<Student><MyReviews /></Student>} />
            <Route path="/student/profile" element={<Student><StudentProfile /></Student>} />
            <Route path="/student/settings" element={<Student><StudentSettings /></Student>} />
            <Route path="/student/payment-methods" element={<Student><PaymentMethods /></Student>} />
            <Route path="/student/messages" element={<Student><StudentMessages /></Student>} />
            <Route path="/student/messages/:id" element={<Student><StudentConversation /></Student>} />

            {/* Instructor */}
            <Route path="/instructor" element={<Instructor><InstructorDashboard /></Instructor>} />
            <Route path="/instructor/dashboard" element={<Navigate to="/instructor" replace />} />
            <Route path="/instructor/courses" element={<Instructor><MyCourses /></Instructor>} />
            <Route path="/instructor/courses/new" element={<Instructor><NewCourse /></Instructor>} />
            <Route path="/instructor/courses/:id/edit" element={<Instructor><NewCourse /></Instructor>} />
            <Route path="/instructor/courses/:id" element={<Instructor><CourseManagement /></Instructor>} />
            <Route path="/instructor/profile" element={<Instructor><InstructorProfile /></Instructor>} />
            <Route path="/instructor/settings" element={<Instructor><InstructorSettings /></Instructor>} />

            <Route path="/instructor/messages" element={<Instructor><InstructorMessages /></Instructor>} />
            <Route path="/instructor/messages/:id" element={<Instructor><InstructorConversation /></Instructor>} />
            <Route path="/instructor/credentials" element={<Instructor><InstructorCredentials /></Instructor>} />
            <Route path="/instructor/roster" element={<Instructor><InstructorRoster /></Instructor>} />

            <Route path="/instructor/reviews" element={<Instructor><InstructorReviews /></Instructor>} />
            <Route path="/instructor/payment-methods" element={<Instructor><PaymentMethods /></Instructor>} />
            <Route path="/instructor/payouts" element={<Instructor><PayoutMethods /></Instructor>} />
            <Route path="/instructor/payout-methods" element={<Instructor><PayoutMethods /></Instructor>} />
            <Route path="/instructor/subscription" element={<Instructor><InstructorSubscription /></Instructor>} />

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute requireRole="admin"><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="owner-console" element={<OwnerConsole />} />
              <Route path="influencers" element={<AdminInfluencerLinks />} />
              <Route path="cockpit" element={<OwnerConsole />} />
              <Route path="brief" element={<WeeklyBrief />} />
              <Route path="users" element={<AdminUsersReal />} />
              <Route path="instructors" element={<AdminInstructors />} />
              <Route path="courses" element={<AdminCoursesReal />} />
              <Route path="waivers" element={<AdminWaivers />} />
              <Route path="reliability" element={<AdminReliability />} />

              <Route path="reports" element={<AdminReports />} />
              <Route path="feedback" element={<AdminFeedback />} />
              <Route path="support" element={<AdminSupportTickets />} />
              <Route path="conversations" element={<AdminConversations />} />
              <Route path="conversations/:id" element={<AdminConversationDetail />} />
              <Route path="moderation" element={<AdminModeration />} />

              <Route path="refunds" element={<AdminRefunds />} />
              <Route path="financials" element={<AdminFinancials />} />
              <Route path="featured" element={<AdminFeaturedCourses />} />
              <Route path="bug-triage" element={<AdminBugTriage />} />
              <Route path="course-editor" element={<AdminCourseEditor />} />
              <Route path="fee-overrides" element={<AdminFeeOverrides />} />
              <Route path="activity" element={<AdminAuditLog />} />
              <Route path="flags" element={<AdminFeatureFlags />} />
              <Route path="test-accounts" element={<AdminTestAccounts />} />
              <Route path="warrior-quotes" element={<AdminWarriorQuotes />} />
              <Route path="security" element={<AdminSecurity />} />
              <Route path="helcim-webhooks" element={<AdminHelcimWebhooks />} />
              <Route path="refund-test" element={<AdminRefundTest />} />
              <Route path="uptime" element={<AdminUptime />} />
              <Route path="background-videos" element={<AdminBackgroundVideos />} />
              <Route path="subscription-plans" element={<AdminSubscriptionPlans />} />
              <Route path="founding-instructors" element={<AdminFoundingInstructors />} />
              <Route path="seo" element={<AdminSEO />} />
              <Route path="deposit-review" element={<AdminDepositReview />} />
              <Route path="settings" element={<AdminPlatformSettings />} />
            </Route>

            <Route path="/notifications" element={<Authed><Notifications /></Authed>} />
            <Route path="/settings/notifications" element={<Authed><NotificationSettings /></Authed>} />
            <Route path="/legal/terms" element={<TermsOfService />} />
            <Route path="/legal/privacy" element={<PrivacyPolicy />} />
            <Route path="/legal/cancellations" element={<CancellationsFAQ />} />
            <Route path="/profile/edit" element={<Authed><EditProfile /></Authed>} />
            <Route path="/support" element={<Authed><HelpCenter /></Authed>} />
            <Route path="/support/contact" element={<Authed><ContactSupport /></Authed>} />
            <Route path="/affiliate" element={<Authed><AffiliateDashboard /></Authed>} />
            <Route path="/affiliate/portal" element={<AffiliatePortal />} />

            {/* Public blog (SEO) */}
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/:slug" element={<BlogPost />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <AIAssistantMount />
          <InstallAppBanner />
          <MissionCompleteWatcher />
          </NavHistoryProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
