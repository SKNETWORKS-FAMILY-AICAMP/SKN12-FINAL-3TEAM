import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // React.StrictMode 임시 비활성화 - useEffect 중복 실행 문제
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
); 