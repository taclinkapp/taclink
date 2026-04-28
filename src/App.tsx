import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound.tsx";
import Notifications from "./pages/Notifications";
import TermsOfService from "./pages/legal/TermsOfService";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import HelpCenter from "./pages/support/HelpCenter";
import ContactSupport from "./pages/support/ContactSupport";

import Splash from "./pages/Splash";
import SignIn from "./pages/auth/SignIn";
import StudentSignUp from "./pages/auth/StudentSignUp";
import InstructorSignUp from "./pages/auth/InstructorSignUp";
import CredentialVerification from "./pages/auth/CredentialVerification";

import Discover from "./pages/student/Discover";
import CourseDetail from "./pages/student/CourseDetail";
import Checkout from "./pages/student/Checkout";
import BookingSuccess from "./pages/student/BookingSuccess";
import MyBookings from "./pages/student/MyBookings";
import MyProgress from "./pages/student/MyProgress";
import BookingDetail from "./pages/student/BookingDetail";
import LeaveReview from "./pages/student/LeaveReview";
import MyReviews from "./pages/student/MyReviews";
import StudentProfile from "./pages/student/StudentProfile";
import StudentSettings from "./pages/student/StudentSettings";
import StudentMessages from "./pages/student/StudentMessages";
import StudentConversation from "./pages/student/StudentConversation";

import InstructorDashboard from "./pages/instructor/InstructorDashboard";
import MyCourses from "./pages/instructor/MyCourses";
import NewCourse from "./pages/instructor/NewCourse";
import CourseManagement from "./pages/instructor/CourseManagement";
import InstructorProfile from "./pages/instructor/InstructorProfile";
import InstructorSettings from "./pages/instructor/InstructorSettings";
import ListingPacks from "./pages/instructor/ListingPacks";
import InstructorMessages from "./pages/instructor/InstructorMessages";
import InstructorConversation from "./pages/instructor/InstructorConversation";

import { AdminLayout } from "./components/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { AdminUsers, AdminInstructors } from "./pages/admin/AdminUsers";
import { AdminCourses, AdminWaitlist, AdminActivity, AdminSettings } from "./pages/admin/AdminCourses";
import { AdminReports } from "./pages/admin/AdminReports";
import { AdminSupportTickets } from "./pages/admin/AdminSupportTickets";
import { DevRoleSwitcher } from "./components/DevRoleSwitcher";

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

            {/* Student */}
            <Route path="/student" element={<Student><Discover /></Student>} />
            <Route path="/student/course/:id" element={<Student><CourseDetail /></Student>} />
            <Route path="/student/checkout/:id" element={<Student><Checkout /></Student>} />
            <Route path="/student/booking-success/:id" element={<Student><BookingSuccess /></Student>} />
            <Route path="/student/bookings" element={<Student><MyBookings /></Student>} />
            <Route path="/student/progress" element={<Student><MyProgress /></Student>} />
            <Route path="/student/booking/:id" element={<Student><BookingDetail /></Student>} />
            <Route path="/student/review/:id" element={<Student><LeaveReview /></Student>} />
            <Route path="/student/reviews" element={<Student><MyReviews /></Student>} />
            <Route path="/student/profile" element={<Student><StudentProfile /></Student>} />
            <Route path="/student/settings" element={<Student><StudentSettings /></Student>} />
            <Route path="/student/messages" element={<Student><StudentMessages /></Student>} />
            <Route path="/student/messages/:id" element={<Student><StudentConversation /></Student>} />

            {/* Instructor */}
            <Route path="/instructor" element={<Instructor><InstructorDashboard /></Instructor>} />
            <Route path="/instructor/courses" element={<Instructor><MyCourses /></Instructor>} />
            <Route path="/instructor/courses/new" element={<Instructor><NewCourse /></Instructor>} />
            <Route path="/instructor/courses/:id" element={<Instructor><CourseManagement /></Instructor>} />
            <Route path="/instructor/profile" element={<Instructor><InstructorProfile /></Instructor>} />
            <Route path="/instructor/settings" element={<Instructor><InstructorSettings /></Instructor>} />
            <Route path="/instructor/listing-packs" element={<Instructor><ListingPacks /></Instructor>} />
            <Route path="/instructor/messages" element={<Instructor><InstructorMessages /></Instructor>} />
            <Route path="/instructor/messages/:id" element={<Instructor><InstructorConversation /></Instructor>} />

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute requireRole="admin"><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="instructors" element={<AdminInstructors />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="waitlist" element={<AdminWaitlist />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="support" element={<AdminSupportTickets />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="/notifications" element={<Authed><Notifications /></Authed>} />
            <Route path="/legal/terms" element={<TermsOfService />} />
            <Route path="/legal/privacy" element={<PrivacyPolicy />} />
            <Route path="/support" element={<Authed><HelpCenter /></Authed>} />
            <Route path="/support/contact" element={<Authed><ContactSupport /></Authed>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIAssistantMount />
          <DevRoleSwitcher />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

