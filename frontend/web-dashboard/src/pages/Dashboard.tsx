import { useEffect } from 'react';
import MainContent from '../components/MainContent';

const Dashboard = () => {
  useEffect(() => {
    console.log('Dashboard 마운트됨');
    console.log('localStorage 상태:', {
      token: localStorage.getItem('token'),
      isLoggedIn: localStorage.getItem('isLoggedIn'),
      user: localStorage.getItem('user')
    });
  }, []);
  
  return (
    <div>
      <MainContent />
    </div>
  );
};

export default Dashboard; 