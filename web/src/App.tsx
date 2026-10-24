import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Loading } from './components/ui';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Exams, ExamCategory, Books, BookDetail, SubjectDetail, TopicDetail, TestsPage } from './pages/Catalog';
import { Instructions } from './pages/Instructions';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth';
import { About, Contact, Privacy, Terms, CookiePolicy, Disclaimer, Help, SitemapPage, NotFound } from './pages/Static';
import { Dashboard, MyResults, MyProgress, BookmarksPage, Revision, Profile, StudentSettings } from './pages/Student';
import { AdminLayout, AdminOverview, AdminCategories, AdminSubjects, AdminTopics, AdminBooks, AdminAttempts, AdminStudents, AdminAnalytics, AdminSettings, AdminAuditLogs, AdminReports } from './pages/admin/Admin';

const Attempt = lazy(() => import('./pages/Attempt').then((m) => ({ default: m.Attempt })));
const Result = lazy(() => import('./pages/Result').then((m) => ({ default: m.Result })));
const AdminQuestions = lazy(() => import('./pages/admin/Questions').then((m) => ({ default: m.AdminQuestions })));
const AdminTests = lazy(() => import('./pages/admin/Tests').then((m) => ({ default: m.AdminTests })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Suspended({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="container section"><Loading label="Loading page…" /></div>}>{children}</Suspense>;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* The live examination has its own chrome and is deliberately outside the site layout. */}
        <Route path="/test/:id/attempt" element={<Suspended><Attempt /></Suspended>} />

        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams/:slug" element={<ExamCategory />} />
          <Route path="/books" element={<Books />} />
          <Route path="/books/:slug" element={<BookDetail />} />
          <Route path="/subjects/:slug" element={<SubjectDetail />} />
          <Route path="/topics/:subjectSlug/:topicSlug" element={<TopicDetail />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/test/:slug/instructions" element={<Instructions />} />
          <Route path="/test/result/:attemptId" element={<Suspended><Result /></Suspended>} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-results" element={<MyResults />} />
          <Route path="/my-progress" element={<MyProgress />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/revision" element={<Revision />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<StudentSettings />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/help" element={<Help />} />
          <Route path="/sitemap" element={<SitemapPage />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="books" element={<AdminBooks />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="subjects" element={<AdminSubjects />} />
            <Route path="topics" element={<AdminTopics />} />
            <Route path="questions" element={<Suspended><AdminQuestions /></Suspended>} />
            <Route path="tests" element={<Suspended><AdminTests /></Suspended>} />
            <Route path="attempts" element={<AdminAttempts />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
