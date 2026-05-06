import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound.tsx";
import Notifications from "./pages/Notifications";
import TermsOfService from "./pages/legal/TermsOfService";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import CancellationsFAQ from "./pages/legal/CancellationsFAQ";
import EditProfile from "./pages/EditProfile";
import HelpCenter from "./pages/support/HelpCenter";
import ContactSupport from "./pages/support/ContactSupport";

import Splash from "./pages/Splash";
import SignIn from "./pages/auth/SignIn";
import StudentSignUp from "./pages/auth/StudentSignUp";
import InstructorSignUp from "./pages/auth/InstructorSignUp";
import CredentialVerification from "./pages/auth/CredentialVerification";
import InviteLanding from "./pages/auth/InviteLanding";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import ChangePassword from "./pages/auth/ChangePassword";
import Unsubscribe from "./pages/Unsubscribe";
import InfluencerLanding from "./pages/auth/InfluencerLanding";

import Discover from "./pages/student/Discover";
import CourseDetail from "./pages/student/CourseDetail";
import Checkout from "./pages/student/Checkout";
import CheckoutReturn from "./pages/student/CheckoutReturn";
import BookingSuccess from "./pages/student/BookingSuccess";
import MyBookings from "./pages/student/MyBookings";
import MyProgress from "./pages/student/MyProgress";
import BookingDetail from "./pages/student/BookingDetail";
import LeaveReview from "./pages/student/LeaveReview";
import MyReviews from "./pages/student/MyReviews";
import StudentProfile from "./pages/student/StudentProfile";
import StudentSettings from "./pages/student/StudentSettings";
import PaymentMethods from "./pages/student/PaymentMethods";
import StudentMessages from "./pages/student/StudentMessages";
import StudentConversation from "./pages/student/StudentConversation";

import InstructorDashboard from "./pages/instructor/InstructorDashboard";
import MyCourses from "./pages/instructor/MyCourses";
import NewCourse from "./pages/instructor/NewCourse";
import CourseManagement from "./pages/instructor/CourseManagement";
import InstructorProfile from "./pages/instructor/InstructorProfile";
import InstructorSettings from "./pages/instructor/InstructorSettings";

import PayoutMethods from "./pages/instructor/PayoutMethods";
import InstructorMessages from "./pages/instructor/InstructorMessages";
import InstructorConversation from "./pages/instructor/InstructorConversation";
import InstructorCredentials from "./pages/instructor/InstructorCredentials";
import InstructorRoster from "./pages/instructor/InstructorRoster";

import InstructorReviews from "./pages/instructor/InstructorReviews";
import InstructorSubscription from "./pages/instructor/InstructorSubscription";

import { AdminLayout } from "./components/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { AdminInstructors } from "./pages/admin/AdminUsers";

import { AdminUsersReal } from "./pages/admin/AdminUsersReal";
import { AdminCoursesReal } from "./pages/admin/AdminCoursesReal";
import { AdminPlatformSettings } from "./pages/admin/AdminPlatformSettings";
import { AdminFeatureFlags } from "./pages/admin/AdminFeatureFlags";
import { AdminAuditLog } from "./pages/admin/AdminAuditLog";
import { AdminReports } from "./pages/admin/AdminReports";
import { AdminSupportTickets } from "./pages/admin/AdminSupportTickets";
import { AdminConversations } from "./pages/admin/AdminConversations";
import { AdminConversationDetail } from "./pages/admin/AdminConversationDetail";
import AdminModeration from "./pages/admin/AdminModeration";
import AdminRefunds from "./pages/admin/AdminRefunds";
import AdminFinancials from "./pages/admin/AdminFinancials";
import AdminFeaturedCourses from "./pages/admin/AdminFeaturedCourses";
import AdminBugTriage from "./pages/admin/AdminBugTriage";
import AdminCourseEditor from "./pages/admin/AdminCourseEditor";
import AdminFeeOverrides from "./pages/admin/AdminFeeOverrides";
import OwnerConsole from "./pages/admin/OwnerConsole";
import AdminInfluencerLinks from "./pages/admin/AdminInfluencerLinks";
import WeeklyBrief from "./pages/admin/WeeklyBrief";
import AdminTestAccounts from "./pages/admin/AdminTestAccounts";
import AdminWarriorQuotes from "./pages/admin/AdminWarriorQuotes";
import AdminSecurity from "./pages/admin/AdminSecurity";
import AdminHelcimWebhooks from "./pages/admin/AdminHelcimWebhooks";
import AdminRefundTest from "./pages/admin/AdminRefundTest";


import { AIAssistantMount } from "./components/AIAssistantMount";

const queryClient = new QueryClient();

const Student = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="student">{children}</ProtectedRoute>
);
const Instructor = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="instructor">{children}</ProtectedRoute>
);
const Authed = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Splash />} />

            {/* Auth */}
            <Route path="/auth/signin" element={<SignIn />} />
            <Route path="/auth/student-signup" element={<StudentSignUp />} />
            <Route path="/auth/instructor-signup" element={<InstructorSignUp />} />
            <Route path="/auth/credential-verification" element={<CredentialVerification />} />
            <Route path="/auth/invite/:code" element={<InviteLanding />}/>
            <Route path="/i/:slug" element={<InfluencerLanding />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/change-password" element={<Authed><ChangePassword /></Authed>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            {/* Student */}
            <Route path="/student" element={<Student><Discover /></Student>} />
            <Route path="/student/course/:id" element={<Student><CourseDetail /></Student>} />
            <Route path="/student/checkout/:id" element={<Student><Checkout /></Student>} />
            <Route path="/student/checkout/:id/return" element={<Student><CheckoutReturn /></Student>} />
            <Route path="/student/booking-success/:id" element={<Student><BookingSuccess /></Student>} />
            <Route path="/student/bookings" element={<Student><MyBookings /></Student>} />
            <Route path="/student/progress" element={<Student><MyProgress /></Student>} />
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
              
              <Route path="reports" element={<AdminReports />} />
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
              <Route path="settings" element={<AdminPlatformSettings />} />
            </Route>

            <Route path="/notifications" element={<Authed><Notifications /></Authed>} />
            <Route path="/legal/terms" element={<TermsOfService />} />
            <Route path="/legal/privacy" element={<PrivacyPolicy />} />
            <Route path="/legal/cancellations" element={<CancellationsFAQ />} />
            <Route path="/profile/edit" element={<Authed><EditProfile /></Authed>} />
            <Route path="/support" element={<Authed><HelpCenter /></Authed>} />
            <Route path="/support/contact" element={<Authed><ContactSupport /></Authed>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIAssistantMount />
          
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

