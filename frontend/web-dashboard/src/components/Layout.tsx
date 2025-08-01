import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';

const Layout = () => {
  const [, setActiveMenu] = useState('home');
  // Home 페이지에서만 RightSidebar 표시 (현재는 비활성화)
  const showRightSidebar = false;

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* 사이드바 */}
      <motion.div
        initial={{ x: -288 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex-shrink-0"
      >
        <Sidebar setActiveMenu={setActiveMenu} />
      </motion.div>
      
      {/* 메인 콘텐츠 */}
      <motion.main 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex-1 overflow-hidden flex flex-col"
      >
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </motion.main>
      
      {/* 오른쪽 사이드바 (필요시 활성화) */}
      {showRightSidebar && (
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-shrink-0"
        >
          <RightSidebar />
        </motion.div>
      )}
    </div>
  );
};

export default Layout; 