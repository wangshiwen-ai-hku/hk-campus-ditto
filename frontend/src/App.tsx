import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "./lib/api";
import { getStoredLocale, getStoredUserId, setStoredLocale, setStoredUserId } from "./lib/session";
import type { Locale, MetaResponse } from "./types";

// Components & Pages
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { JoinPage } from "./pages/JoinPage";
import { StudentPage } from "./pages/StudentPage";
import { AdminPage } from "./pages/AdminPage";

function useMeta() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  useEffect(() => { 
    api.getMeta().then((d) => setMeta(d as MetaResponse)).catch(console.error);
  }, []);
  return meta;
}

export default function App() {
  const meta = useMeta();
  const { i18n } = useTranslation();
  const [localeState, setLocaleState] = useState<Locale>(getStoredLocale());
  const [userIdState, setUserIdState] = useState<string | null>(getStoredUserId());
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  function setLocale(v: Locale) { 
    setLocaleState(v); 
    setStoredLocale(v); 
    i18n.changeLanguage(v);
  }
  
  function setUser(v: string | null) { 
    setUserIdState(v); 
    setStoredUserId(v); 
  }

  return (
    <Layout 
      locale={localeState} 
      onLocale={setLocale} 
      userId={userIdState} 
      onUser={setUser}
    >
      <Routes>
        <Route path="/" element={<HomePage onUser={setUser} />} />
        <Route path="/join" element={<JoinPage userId={userIdState} onUser={setUser} />} />
        <Route path="/student" element={<StudentPage userId={userIdState} />} />
        <Route path="/admin" element={<AdminPage onUser={setUser} />} />
      </Routes>
    </Layout>
  );
}
