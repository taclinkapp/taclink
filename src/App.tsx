import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";

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
import BookingDetail from "./pages/student/BookingDetail";
import LeaveReview from "./pages/student/LeaveReview";
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
import { DevRoleSwitcher } from "./components/DevRoleSwitcher";
import { ReportIssueButton } from "./components/ReportIssueButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Splash />} />

          {/* Auth */}
          <Route path="/auth/signin" element={<SignIn />} />
          <Route path="/auth/student-signup" element={<StudentSignUp />} />
          <Route path="/auth/instructor-signup" element={<InstructorSignUp />} />
          <Route path="/auth/credential-verification" element={<CredentialVerification />} />

          {/* Student */}
          <Route path="/student" element={<Discover />} />
          <Route path="/student/course/:id" element={<CourseDetail />} />
          <Route path="/student/checkout/:id" element={<Checkout />} />
          <Route path="/student/booking-success/:id" element={<BookingSuccess />} />
          <Route path="/student/bookings" element={<MyBookings />} />
          <Route path="/student/booking/:id" element={<BookingDetail />} />
          <Route path="/student/review/:id" element={<LeaveReview />} />
          <Route path="/student/profile" element={<StudentProfile />} />
          <Route path="/student/settings" element={<StudentSettings />} />
          <Route path="/student/messages" element={<StudentMessages />} />
          <Route path="/student/messages/:id" element={<StudentConversation />} />

          {/* Instructor */}
          <Route path="/instructor" element={<InstructorDashboard />} />
          <Route path="/instructor/courses" element={<MyCourses />} />
          <Route path="/instructor/courses/new" element={<NewCourse />} />
          <Route path="/instructor/courses/:id" element={<CourseManagement />} />
          <Route path="/instructor/profile" element={<InstructorProfile />} />
          <Route path="/instructor/settings" element={<InstructorSettings />} />
          <Route path="/instructor/listing-packs" element={<ListingPacks />} />
          <Route path="/instructor/messages" element={<InstructorMessages />} />
          <Route path="/instructor/messages/:id" element={<InstructorConversation />} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="instructors" element={<AdminInstructors />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="waitlist" element={<AdminWaitlist />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        <ReportIssueButton />
        <DevRoleSwitcher />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
